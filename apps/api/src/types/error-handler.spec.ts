import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { errorHandler } from "./error-handler.js";

function request() {
  return {
    log: {
      error: vi.fn(),
    },
  } as unknown as FastifyRequest;
}

function reply() {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));

  return {
    fastifyReply: { status } as unknown as FastifyReply,
    send,
    status,
  };
}

describe("errorHandler", () => {
  it("does not expose infrastructure error codes to clients", () => {
    const response = reply();
    const error = Object.assign(new Error("column role does not exist"), {
      code: "42703",
    }) as FastifyError;

    errorHandler(error, request(), response.fastifyReply);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.send).toHaveBeenCalledWith({
      error: {
        code: "internal.unexpected_error",
        message: "Internal server error",
      },
    });
  });

  it("keeps actionable client error details", () => {
    const response = reply();
    const error = Object.assign(new Error("Invalid request"), {
      code: "FST_ERR_VALIDATION",
      statusCode: 400,
    }) as FastifyError;

    errorHandler(error, request(), response.fastifyReply);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      error: {
        code: "request.validation_failed",
        message: "Invalid request",
      },
    });
  });
});
