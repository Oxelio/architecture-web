import type { Writable } from "node:stream";

import { type FastifyInstance, LogController } from "fastify";

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

// Default HTTP records and the req/err serializers omit raw request data and exception text.
export function httpLoggingOptions(stream?: Writable) {
  return {
    logController: new LogController({
      disableRequestLogging: true,
    }),
    requestIdHeader: false as const,
    logger: {
      level: "info",
      ...(stream ? { stream } : {}),
      serializers: {
        req: (request: { method?: string }) => ({
          method: safeMethod(request.method),
        }),
        res: (reply: { statusCode: number }) => ({
          statusCode: reply.statusCode,
        }),
        err: () => ({
          type: "Error",
          message: "[redacted]",
          stack: "[redacted]",
          category: "redacted_error",
        }),
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
