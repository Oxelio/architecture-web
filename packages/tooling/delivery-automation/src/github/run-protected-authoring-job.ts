import { z } from "zod";

import { readPreparedAuthoringRequest } from "../control/authoring-request.js";
import { createAuthoringTerminalResultReader } from "../intake/authoring-terminal-result.js";
import { payloadDigest } from "../intake/sealed-authoring-store.js";
import {
  type AuthoringExecutionPorts,
  executeControlledAuthoring,
} from "./controlled-authoring-execution.js";
import type { createGitHubWorkReservationJournal } from "./github-work-reservation-journal.js";

type JournalReader = Pick<
  ReturnType<typeof createGitHubWorkReservationJournal>,
  "readAuthoringRequest"
>;
const digest = /^[a-f0-9]{64}$/u;
const header = z.strictObject({
  request: z.unknown(),
  createdAt: z.number().int().safe(),
  expiresAt: z.number().int().safe(),
  payloadBase64: z.string(),
});

async function readBounded(
  response: Response,
  maximumBytes: number,
): Promise<unknown> {
  if (response.status !== 200 || !response.body) {
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      size += chunk.value.byteLength;
      if (size > maximumBytes) {
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
  ) as unknown;
}

interface WorkerInput {
  readonly enabled?: boolean;
  readonly intakeOrigin: string;
  readonly workflowSha: string;
  readonly requestId: string;
  readonly expectedPayloadDigest: string;
  readonly maximumExchangeBytes: number;
  readonly maximumHistoryRevisions: number;
  readonly getJobToken: () => Promise<string>;
  readonly ports: AuthoringExecutionPorts;
  readonly journalReader: JournalReader;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}

function validOrigin(input: WorkerInput) {
  const origin = new URL(input.intakeOrigin);
  return origin.protocol === "https:" && origin.origin === input.intakeOrigin;
}

async function readSealedRequest(input: WorkerInput) {
  const response = await (input.fetchImpl ?? fetch)(
    `${input.intakeOrigin}/jobs/${input.requestId}/${input.expectedPayloadDigest}`,
    {
      headers: { Authorization: `Bearer ${await input.getJobToken()}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  const parsed = header.safeParse(
    await readBounded(response, input.maximumExchangeBytes),
  );
  if (!parsed.success) {
    return null;
  }
  const { createdAt, expiresAt, payloadBase64 } = parsed.data;
  const request = readPreparedAuthoringRequest(parsed.data.request);
  const payload = Buffer.from(payloadBase64, "base64");
  const now = (input.now ?? Date.now)();
  return request?.requestId === input.requestId &&
    request.command.payloadDigest === input.expectedPayloadDigest &&
    createdAt <= now &&
    now < expiresAt &&
    payload.toString("base64") === payloadBase64 &&
    payloadDigest(payload) === input.expectedPayloadDigest
    ? { request, payload, expiresAt }
    : null;
}

// The callback reports the immutable journal's result. A lost callback can
// leave the client pending, but cannot retry or settle the GitHub operation.
async function reportOutcome(
  input: WorkerInput,
  request: NonNullable<ReturnType<typeof readPreparedAuthoringRequest>>,
) {
  const result = await createAuthoringTerminalResultReader({
    maximumHistoryRevisions: input.maximumHistoryRevisions,
    readReceipt: input.journalReader.readAuthoringRequest,
  })(request);
  if (!result) {
    return "deferred" as const;
  }
  const response = await (input.fetchImpl ?? fetch)(
    `${input.intakeOrigin}/jobs/${input.requestId}/result`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await input.getJobToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  return response.status === 200
    ? ("reported" as const)
    : ("deferred" as const);
}

export async function runProtectedAuthoringJob(input: WorkerInput) {
  if (input.enabled !== true) {
    return "inactive" as const;
  }
  try {
    if (
      !validOrigin(input) ||
      !digest.test(input.requestId) ||
      !digest.test(input.expectedPayloadDigest) ||
      !Number.isSafeInteger(input.maximumExchangeBytes) ||
      input.maximumExchangeBytes < 1 ||
      !Number.isSafeInteger(input.maximumHistoryRevisions) ||
      input.maximumHistoryRevisions < 1 ||
      !(await input.ports.verifyBoundary())
    ) {
      return "denied" as const;
    }
    const sealed = await readSealedRequest(input);
    if (!sealed) {
      return "deferred" as const;
    }
    const operation = await executeControlledAuthoring({
      enabled: true,
      workflowSha: input.workflowSha,
      maximumHistoryRevisions: input.maximumHistoryRevisions,
      request: sealed.request,
      payload: sealed.payload,
      ports: {
        ...input.ports,
        verifyBoundary: async () =>
          (input.now ?? Date.now)() < sealed.expiresAt &&
          input.ports.verifyBoundary(),
      },
    });
    if (operation === "replan") {
      return "replan" as const;
    }
    return await reportOutcome(input, sealed.request);
  } catch {
    return "deferred" as const;
  }
}
