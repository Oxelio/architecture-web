// @file apps/api/src/types/error-handler.ts

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  const statusCode = error.statusCode ?? 500;

  return reply.status(statusCode).send({
    error: {
      code: error.code ?? "INTERNAL_SERVER_ERROR",
      message: statusCode >= 500 ? "Internal server error" : error.message,
    },
  });
}
