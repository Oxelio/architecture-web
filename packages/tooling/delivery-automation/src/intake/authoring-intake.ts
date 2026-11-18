import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  prepareAuthoringRequest,
  type PreparedAuthoringRequest,
} from "../control/authoring-request.js";
import type {
  AuthoringJobBinding,
  PrivateAuthoringResult,
  SealedAuthoringStore,
} from "./sealed-authoring-store.js";

interface IntakeCaller {
  readonly subject: string;
  readonly tokenDigest: string;
  readonly workNumbers: readonly number[];
}

export interface AuthoringIntakeConfiguration {
  readonly enabled?: boolean;
  readonly publicOrigin: string;
  readonly maximumRequestBytes: number;
  readonly callers: readonly IntakeCaller[];
  readonly store: SealedAuthoringStore;
  readonly authenticateJob: (
    token: string,
  ) => Promise<AuthoringJobBinding | null>;
  readonly dispatch: (
    requestId: string,
    payloadDigest: string,
  ) => Promise<unknown>;
  // The protected reader returns a dated private view, never its credential.
  readonly readProjectContext: (subject: string) => Promise<unknown>;
  readonly acceptProjectContext?: (value: unknown) => boolean;
  readonly readTerminalResult?: (
    request: PreparedAuthoringRequest,
  ) => Promise<PrivateAuthoringResult | null>;
}

function bearer(request: Request) {
  const value = request.headers.get("authorization");
  return value?.match(/^Bearer ([A-Za-z0-9._~-]{32,8192})$/u)?.[1] ?? null;
}

function caller(request: Request, configuration: AuthoringIntakeConfiguration) {
  const token = bearer(request);
  if (!token) {
    return null;
  }
  const digest = createHash("sha256").update(token).digest();
  const matches = configuration.callers.filter(({ tokenDigest }) =>
    timingSafeEqual(digest, Buffer.from(tokenDigest, "hex")),
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function toolResult(operation: () => Promise<unknown>) {
  let value: unknown;
  try {
    value = await operation();
  } catch {
    value = { status: "unavailable" };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

async function boundedJson(
  request: Request,
  maximum: number,
): Promise<unknown> {
  if (
    !request.headers.get("content-type")?.startsWith("application/json") ||
    !request.body
  ) {
    throw new Error("AUTHORING_BODY_INVALID");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) {
        break;
      }
      size += part.value.byteLength;
      if (size > maximum) {
        throw new Error("AUTHORING_BODY_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

const resultSchema = z.strictObject({
  status: z.enum(["confirmed", "denied", "not-applied"]),
  canonicalUrls: z
    .array(
      z
        .string()
        .regex(
          /^https:\/\/github\.com\/Oxelio\/architecture-web\/(?:issues|pull|commit|actions\/runs)\/[A-Za-z0-9/#._-]+$/u,
        ),
    )
    .max(20),
});

async function submit(
  caller: IntakeCaller,
  envelope: unknown,
  payloadBase64: string,
  configuration: AuthoringIntakeConfiguration,
) {
  const request = prepareAuthoringRequest({
    authenticatedSubject: caller.subject,
    envelope,
  });
  if (!request || !caller.workNumbers.includes(request.workNumber)) {
    return { status: "denied" };
  }
  const bytes = Buffer.from(payloadBase64, "base64");
  if (bytes.toString("base64") !== payloadBase64) {
    return { status: "denied" };
  }
  const sealed = await configuration.store.seal(request, bytes);
  if (sealed === "rejected" || sealed === "conflict" || sealed === "expired") {
    return { status: sealed, requestId: request.requestId };
  }
  if (await configuration.store.claimDispatch(request.requestId)) {
    // No retry after uncertain dispatch. A duplicate intake call may only
    // observe this request; durable controller history owns execution replay.
    try {
      await configuration.dispatch(
        request.requestId,
        request.command.payloadDigest,
      );
    } catch {
      // Keep the durable dispatch claim uncertain; never expose API errors.
    }
  }
  return { status: "pending", requestId: request.requestId };
}

function server(
  caller: IntakeCaller,
  configuration: AuthoringIntakeConfiguration,
) {
  const { subject, workNumbers } = caller;
  const mcp = new McpServer({
    name: "architecture-web-authoring",
    version: "1.0.0",
  });
  mcp.registerTool(
    "submit-authoring-request",
    {
      description:
        "Stage one typed Architecture Web operation. This is not authority or merge admission.",
      inputSchema: z.strictObject({
        envelope: z.unknown(),
        payloadBase64: z.string(),
      }),
    },
    async ({ envelope, payloadBase64 }) =>
      toolResult(() => submit(caller, envelope, payloadBase64, configuration)),
  );
  mcp.registerTool(
    "read-authoring-result",
    {
      description:
        "Read this caller's existing request result without repeating its operation.",
      inputSchema: z.strictObject({
        requestId: z.string().regex(/^[a-f0-9]{64}$/u),
      }),
    },
    ({ requestId }) =>
      toolResult(async () => {
        const header = await configuration.store.header(requestId);
        const actorDigest = createHash("sha256")
          .update(JSON.stringify(["authoring-actor", 1336937640, subject]))
          .digest("hex");
        if (
          !header ||
          header.request.actorDigest !== actorDigest ||
          !workNumbers.includes(header.request.workNumber)
        ) {
          return { status: "unavailable" };
        }
        await configuration.store.expirePayload(requestId);
        return (
          (await configuration.store.result(requestId)) ??
          (await configuration.readTerminalResult?.(header.request)) ?? {
            status: "pending",
          }
        );
      }),
  );
  mcp.registerTool(
    "read-project-context",
    {
      description:
        "Read a dated private Project #3 projection from the protected reader.",
      inputSchema: z.strictObject({}),
    },
    () => toolResult(() => configuration.readProjectContext(subject)),
  );
  return mcp;
}

async function jobExchange(
  request: Request,
  configuration: AuthoringIntakeConfiguration,
) {
  const match = new URL(request.url).pathname.match(
    /^\/jobs\/([a-f0-9]{64})\/(?:([a-f0-9]{64})|(result))$/u,
  );
  const token = bearer(request);
  const job = token ? await configuration.authenticateJob(token) : null;
  if (
    new URL(request.url).pathname === "/jobs/project-context" &&
    job &&
    request.method === "POST" &&
    configuration.acceptProjectContext
  ) {
    const accepted = configuration.acceptProjectContext(
      await boundedJson(request, configuration.maximumRequestBytes),
    );
    return response(
      { status: accepted ? "recorded" : "denied" },
      accepted ? 200 : 403,
    );
  }
  if (!match?.[1] || !job) {
    return response({ status: "denied" }, 403);
  }
  const requestId = match[1];
  if (request.method === "GET" && match[2]) {
    const sealed = await configuration.store.fetchPayload(
      requestId,
      match[2],
      job,
    );
    if (!sealed) {
      return response({ status: "unavailable" }, 404);
    }
    return response({
      ...sealed.header,
      payloadBase64: sealed.payload.toString("base64"),
    });
  }
  if (request.method === "POST" && match[3]) {
    const result = resultSchema.safeParse(
      await boundedJson(request, configuration.maximumRequestBytes),
    );
    if (
      result.success &&
      (await configuration.store.recordResult(
        requestId,
        job,
        result.data as PrivateAuthoringResult,
      ))
    ) {
      await configuration.store.disposePayload(requestId);
      return response({ status: "recorded" });
    }
  }
  return response({ status: "denied" }, 403);
}

// Construction never listens or provisions credentials. Deployment must supply
// a private TLS boundary, explicit staging limits and isolated dispatch access.
export function createAuthoringIntake(
  configuration: AuthoringIntakeConfiguration,
) {
  const origin = new URL(configuration.publicOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== configuration.publicOrigin ||
    !Number.isSafeInteger(configuration.maximumRequestBytes) ||
    configuration.maximumRequestBytes < 1 ||
    configuration.callers.length === 0 ||
    configuration.callers.some(
      ({ subject, tokenDigest, workNumbers }) =>
        !/^[A-Za-z0-9_+=:/.-]{1,200}$/u.test(subject) ||
        !/^[a-f0-9]{64}$/u.test(tokenDigest) ||
        workNumbers.some(
          (number) => !Number.isSafeInteger(number) || number < 1,
        ),
    ) ||
    new Set(configuration.callers.map(({ tokenDigest }) => tokenDigest))
      .size !== configuration.callers.length
  ) {
    throw new Error("AUTHORING_INTAKE_CONFIGURATION_INVALID");
  }
  const mcp = createMcpHandler(
    ({ requestInfo }) => {
      const authenticated = requestInfo
        ? caller(requestInfo, configuration)
        : null;
      if (!authenticated) {
        throw new Error("AUTHORING_CALLER_UNVERIFIED");
      }
      return server(authenticated, configuration);
    },
    {
      responseMode: "json",
      maxRequestBodySize: configuration.maximumRequestBytes,
      onerror: () => undefined,
    },
  );
  return {
    close: mcp.close,
    async fetch(request: Request): Promise<Response> {
      if (configuration.enabled !== true) {
        return response({ status: "inactive" }, 503);
      }
      const url = new URL(request.url);
      if (
        url.origin !== origin.origin ||
        url.search ||
        (request.headers.has("origin") &&
          request.headers.get("origin") !== origin.origin)
      ) {
        return response({ status: "denied" }, 403);
      }
      try {
        if (url.pathname.startsWith("/jobs/")) {
          return await jobExchange(request, configuration);
        }
        if (url.pathname !== "/mcp" || !caller(request, configuration)) {
          return response({ status: "denied" }, 403);
        }
        const result = await mcp.fetch(request);
        result.headers.set("Cache-Control", "no-store");
        return result;
      } catch {
        // Never log request bodies, bearer values, Project data or API errors.
        return response({ status: "unavailable" }, 503);
      }
    },
  };
}

// Mount only behind the trusted TLS reverse proxy. No forwarded header can
// replace the configured public origin. Calling this function does not listen.
export function createAuthoringIntakeNodeServer(
  configuration: AuthoringIntakeConfiguration,
) {
  const intake = createAuthoringIntake(configuration);
  const origin = new URL(configuration.publicOrigin);
  const handler = toNodeHandler(
    {
      fetch: (request) => {
        if (request.headers.get("host") !== origin.host) {
          return Promise.resolve(response({ status: "denied" }, 403));
        }
        const path = new URL(request.url);
        return intake.fetch(
          new Request(
            `${origin.origin}${path.pathname}${path.search}`,
            request,
          ),
        );
      },
    },
    { maxRequestBodySize: configuration.maximumRequestBytes },
  );
  return {
    server: createServer((request, result) => {
      if (!request.method || !request.url) {
        result.writeHead(400).end();
        return;
      }
      void handler(
        Object.assign(request, { method: request.method, url: request.url }),
        result,
      ).catch(() => {
        if (!result.headersSent) {
          result.writeHead(503);
        }
        result.end();
      });
    }),
    close: intake.close,
  };
}
