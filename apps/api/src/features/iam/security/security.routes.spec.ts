import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
const Result = {
  success: <T>(value: T) => ({ success: true as const, value }),
  failure: (error: { code: string }) => ({ success: false as const, error }),
};
import type { IamSecurityApplication } from "@architecture/iam/application";

import { errorHandler } from "#types/error-handler";

import { buildSecurityRoutes } from "./security.routes.js";
const instances: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(instances.splice(0).map((app) => app.close()));
});
async function server(
  security: Partial<IamSecurityApplication>,
  authenticated = true,
) {
  const app = Fastify();
  instances.push(app);
  app.setErrorHandler(errorHandler);
  await app.register(fastifyCookie);
  app.decorateRequest("auth", null);
  app.decorate("authenticate", async (request) => {
    if (authenticated) {
      request.auth = {
        userId: "authoritative-actor",
        sessionId: "session",
        role: "user",
      };
    }
  });
  await app.register(
    buildSecurityRoutes(
      security as IamSecurityApplication,
      { name: "sid", options: { httpOnly: true, path: "/", sameSite: "lax" } },
      {} as never,
      {} as never,
      { record: async () => undefined },
    ),
  );
  await app.ready();
  return app;
}
describe("security HTTP application boundary", () => {
  it("preserves the enrollment-specific invalid-code status", async () => {
    const app = await server({
      confirmMfaEnrollment: {
        execute: async () => Result.failure({ code: "MFA_CODE_INVALID" }),
      } as never,
    });
    const response = await app.inject({
      method: "POST",
      url: "/me/mfa/enrollment/confirm",
      payload: { code: "123456" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: "MFA_CODE_INVALID" } });
  });
  it("presents a missing enrolled factor as a state conflict", async () => {
    const app = await server({
      regenerateBackupCodes: {
        execute: async () => Result.failure({ code: "MFA_NOT_ENABLED" }),
      } as never,
    });
    const response = await app.inject({
      method: "POST",
      url: "/me/mfa/backup-codes",
      payload: { password: "password", mfaCode: "123456" },
    });
    expect(response.statusCode).toBe(409);
  });
  it("uses the authenticated owner even when a body supplies a different userId", async () => {
    const execute = vi.fn(async () => Result.success(undefined)),
      app = await server({ activateMfa: { execute } as never });
    const response = await app.inject({
      method: "POST",
      url: "/me/mfa/enrollment/backup-codes/confirm",
      payload: {
        confirmationId: "confirmation",
        backupCodesSaved: true,
        userId: "another-account",
      },
    });
    expect(response.statusCode).toBe(204);
    expect(execute).toHaveBeenCalledWith({
      confirmationId: "confirmation",
      backupCodesSaved: true,
      userId: "authoritative-actor",
    });
  });
  it("guards missing authenticated context at the controller boundary", async () => {
    const execute = vi.fn(),
      app = await server({ getMfaStatus: { execute } as never }, false);
    const response = await app.inject({ url: "/me/mfa" });
    expect(response.statusCode).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });
  it("returns explicit password validation errors from recovery", async () => {
    const app = await server({
      resetPassword: {
        execute: async () => Result.failure({ code: "password.compromised" }),
      } as never,
    });
    const response = await app.inject({
      method: "POST",
      url: "/recovery/reset",
      payload: {
        token: "confidential-token",
        password: "replacement",
        passwordConfirmation: "replacement",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "password.compromised" },
    });
    expect(response.body).not.toContain("confidential-token");
  });
  it("does not convert an unexpected dependency failure into a business result", async () => {
    const app = await server({
      resetPassword: {
        execute: async () => {
          throw new Error("storage failed");
        },
      } as never,
    });
    const response = await app.inject({
      method: "POST",
      url: "/recovery/reset",
      payload: {
        token: "confidential-token",
        password: "replacement",
        passwordConfirmation: "replacement",
      },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(response.body).not.toContain("storage failed");
  });
  it("issues a protected cookie only after successful MFA completion", async () => {
    const app = await server({
      completeMfaSignIn: {
        execute: async () =>
          Result.success({
            sessionId: "credential",
            sessionExpiresAt: new Date(Date.now() + 60000),
            userId: "actor",
          }),
      } as never,
    });
    const response = await app.inject({
      method: "POST",
      url: "/mfa/challenge/verify",
      payload: { challengeId: "challenge", code: "123456" },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.body).toBe("");
  });
  it("rejects malformed transport input without invoking the use case", async () => {
    const execute = vi.fn(),
      app = await server({ resetPassword: { execute } as never });
    const response = await app.inject({
      method: "POST",
      url: "/recovery/reset",
      payload: { token: "token" },
    });
    expect(response.statusCode).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
  it("preserves EMAIL_INVALID when schema validation rejects a missing recovery address", async () => {
    const execute = vi.fn(),
      app = await server({ requestRecovery: { execute } as never });
    const response = await app.inject({
      method: "POST",
      url: "/recovery",
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: "EMAIL_INVALID" } });
    expect(execute).not.toHaveBeenCalled();
  });
  it("preserves the established recovery confirmation code", async () => {
    const app = await server({
      resetPassword: {
        execute: async () =>
          Result.failure({ code: "password.confirmation_mismatch" }),
      } as never,
    });
    const response = await app.inject({
      method: "POST",
      url: "/recovery/reset",
      payload: {
        token: "private-token",
        password: "one",
        passwordConfirmation: "two",
      },
    });
    expect(response.json()).toEqual({
      error: { code: "PASSWORD_CONFIRMATION_MISMATCH" },
    });
  });
  it.each([true, false])(
    "clears the MFA cookie only on successful deactivation (%s)",
    async (success) => {
      const app = await server({
        disableMfa: {
          execute: async () =>
            success
              ? Result.success(undefined)
              : Result.failure({ code: "MFA_CODE_INVALID" }),
        } as never,
      });
      const response = await app.inject({
        method: "DELETE",
        url: "/me/mfa",
        payload: { password: "private-password", mfaCode: "123456" },
      });
      expect(response.statusCode).toBe(success ? 204 : 401);
      if (success) {
        expect(response.headers["set-cookie"]).toContain("sid=;");
      } else {
        expect(response.headers["set-cookie"]).toBeUndefined();
      }
    },
  );
  it.each([
    ["POST", "/mfa/challenge/verify", "MFA_CHALLENGE_INVALID"],
    ["POST", "/deletion/cancel", "DELETION_CANCELLATION_INVALID"],
    ["POST", "/me/mfa/enrollment", "PASSWORD_REQUIRED"],
    ["POST", "/me/mfa/enrollment/confirm", "MFA_CODE_REQUIRED"],
    [
      "POST",
      "/me/mfa/enrollment/backup-codes/confirm",
      "MFA_BACKUP_CODES_CONFIRMATION_REQUIRED",
    ],
    ["POST", "/me/mfa/backup-codes", "STRONG_AUTHENTICATION_REQUIRED"],
    ["DELETE", "/me/mfa", "STRONG_AUTHENTICATION_REQUIRED"],
    ["POST", "/me/exports", "PASSWORD_REQUIRED"],
    ["POST", "/me/deletion", "DELETION_REQUEST_INVALID"],
  ] as const)(
    "preserves missing-field business errors for %s %s",
    async (method, url, code) => {
      const app = await server({});
      const response = await app.inject({ method, url, payload: {} });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: { code } });
    },
  );
});
