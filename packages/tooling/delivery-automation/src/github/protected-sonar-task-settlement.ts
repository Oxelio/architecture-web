import { createHash } from "node:crypto";

import { z } from "zod";

import type { AuthoringOutcomeProof } from "./controlled-authoring-execution.js";
import type { ProtectedSonarSubmission } from "./sonar-analysis-evidence.js";

const task = z.object({
  task: z.object({
    id: z.string(),
    componentKey: z.literal("Oxelio_architecture-web"),
    type: z.literal("REPORT"),
    status: z.enum(["SUCCESS", "FAILED", "CANCELED"]),
    submittedAt: z.string(),
    executedAt: z.string(),
  }),
});

// Transport settlement only. Failed or cancelled CE tasks prove that an
// earlier submission ended, while the quality evaluator still rejects them.
export async function readProtectedSonarTaskSettlement(input: {
  readonly token: string;
  readonly readTrustedSubmission: () => Promise<ProtectedSonarSubmission | null>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}): Promise<AuthoringOutcomeProof | null> {
  if (!input.token.trim()) {
    return null;
  }
  try {
    const submitted = await input.readTrustedSubmission();
    if (
      !submitted ||
      submitted.projectKey !== "Oxelio_architecture-web" ||
      submitted.repositoryId !== 1336937640 ||
      !/^[A-Za-z0-9_-]{1,200}$/u.test(submitted.taskId)
    ) {
      return null;
    }
    const response = await (input.fetchImpl ?? fetch)(
      `https://sonarcloud.io/api/ce/task?id=${encodeURIComponent(submitted.taskId)}`,
      {
        headers: {
          Authorization: `Bearer ${input.token}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (response.status !== 200) {
      return null;
    }
    const parsed = task.safeParse(await response.json());
    if (!parsed.success || parsed.data.task.id !== submitted.taskId) {
      return null;
    }
    const observed = parsed.data.task;
    const times = [
      submitted.startedAt,
      observed.submittedAt,
      observed.executedAt,
    ].map((value) => Date.parse(value));
    const [start = Number.NaN, sent = Number.NaN, ended = Number.NaN] = times;
    if (!(
      start <= sent &&
      sent <= ended &&
      ended <= (input.now ?? Date.now)()
    )) {
      return null;
    }
    return {
      outcome: "confirmed",
      proofDigest: createHash("sha256")
        .update(JSON.stringify([submitted, observed]))
        .digest("hex"),
    };
  } catch {
    return null;
  }
}
