import { Writable } from "node:stream";

import type { VerifyEmail } from "@architecture/iam/application";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import {
  httpLoggingOptions,
  registerHttpRequestLogging,
} from "../../../http-logging.js";
import { errorHandler } from "../../../types/error-handler.js";
import type { IamControllers } from "../compose-controllers.js";
import { registerPublicRoutes } from "../routes/public.routes.js";
import { createVerifyEmailController } from "./verify-email.controller.js";

function createServer(execute: ReturnType<typeof vi.fn>, logs?: string[]) {
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      logs?.push(chunk.toString("utf8"));
      callback();
    },
  });
  const app = Fastify(httpLoggingOptions(stream));
  registerHttpRequestLogging(app);
  app.setErrorHandler(errorHandler);
  const noop = async () => undefined;
  const controllers = {
    verifyEmail: createVerifyEmailController({ execute } as VerifyEmail),
    signUp: noop,
    signIn: noop,
    signOut: noop,
    getPasswordPolicy: noop,
    evaluatePassword: noop,
  } as unknown as IamControllers;
  app.register(registerPublicRoutes(controllers), { prefix: "/v1/iam" });
  return app;
}

describe("public verification POST contract", () => {
  it("requires an explicit JSON body and does not register the legacy GET endpoint", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ success: true, value: undefined });
    const app = createServer(execute);
    try {
      const missing = await app.inject({
        method: "POST",
        url: "/v1/iam/verify",
        payload: {},
      });
      const queryOnly = await app.inject({
        method: "POST",
        url: "/v1/iam/verify?token=legacy",
      });
      const legacy = await app.inject({
        method: "GET",
        url: "/v1/iam/verify?token=legacy",
      });
      expect(missing.statusCode).toBe(400);
      expect(queryOnly.statusCode).toBe(400);
      expect(legacy.statusCode).toBe(404);
      expect(execute).not.toHaveBeenCalled();
      const verified = await app.inject({
        method: "POST",
        url: "/v1/iam/verify",
        payload: { token: "synthetic-verification-token" },
      });
      expect(verified.statusCode).toBe(204);
      expect(execute).toHaveBeenCalledExactlyOnceWith({
        token: "synthetic-verification-token",
      });
    } finally {
      await app.close();
    }
  });

  it("preserves business error semantics and redacts POST tokens from HTTP logs", async () => {
    const token = "SYNTHETIC_CANARY_152_+/=";
    const logs: string[] = [];
    const execute = vi.fn().mockResolvedValue({
      success: false,
      error: { code: "email_verification.expired_token" },
    });
    const app = createServer(execute, logs);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/iam/verify",
        payload: { token },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "email_verification.expired_token" },
      });
      expect(execute).toHaveBeenCalledWith({ token });
      expect(response.body).not.toContain(token);
    } finally {
      await app.close();
    }
    expect(logs.join("")).not.toContain(token);
  });
});
