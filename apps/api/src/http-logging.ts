import type { Writable } from "node:stream";

import type { FastifyInstance } from "fastify";

function safeMethod(method: string | undefined): string {
  switch (method) {
    case "GET":
    case "HEAD":
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
    case "OPTIONS":
      return method;
    default:
      return "OTHER";
  }
}

// Request URLs, credential-bearing fields and raw exceptions never reach Pino.
export function httpLoggingOptions(stream?: Writable) {
  return {
    disableRequestLogging: true,
    requestIdHeader: false,
    logger: {
      level: "info",
      ...(stream ? { stream } : {}),
      serializers: {
        req: (request: { method?: string }) => ({
          method: safeMethod(request.method),
        }),
        res: (reply: { statusCode?: number }) => ({
          statusCode: reply.statusCode,
        }),
        err: () => ({ category: "redacted_error" }),
      },
    },
  };
}

export function registerHttpRequestLogging(app: FastifyInstance): void {
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: safeMethod(request.method),
        route: request.routeOptions.url ?? "[unmatched]",
        statusCode: reply.statusCode,
        requestId: String(request.id),
        durationMs: Math.round(reply.elapsedTime),
      },
      "HTTP request completed",
    );
  });
}
