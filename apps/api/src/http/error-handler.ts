// @file apps/api/src/http/error-handler.ts

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  return reply.status(error.statusCode ?? 500).send({
    message: error.message,
  });
}
