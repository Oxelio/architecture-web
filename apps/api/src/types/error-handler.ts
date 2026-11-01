// @file apps/api/src/types/error-handler.ts

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  const statusCode =
    error.statusCode && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : 500;
  const isServerError = statusCode >= 500;
  const clientErrorCode =
    error.validation || error.code === "FST_ERR_VALIDATION"
      ? "request.validation_failed"
      : "request.invalid";

  return reply.status(statusCode).send({
    error: {
      code: isServerError ? "internal.unexpected_error" : clientErrorCode,
      message: isServerError ? "Internal server error" : error.message,
    },
  });
}
