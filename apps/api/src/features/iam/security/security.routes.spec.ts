import type { AuditApplication } from "@architecture/audit/application";
import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
const Result = {
  success: <T>(value: T) => ({ success: true as const, value }),
  failure: <const E extends { readonly code: string }>(error: E) => ({
    success: false as const,
    error,
  }),
};
import type { IamApplication } from "@architecture/iam/application";

import { errorHandler } from "#types/error-handler";

import { buildSecurityRoutes } from "./security.routes.js";
const instances: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(instances.splice(0).map((app) => app.close()));
});
async function server(
  iam: { [K in keyof IamApplication]?: Partial<IamApplication[K]> },
  authenticated = true,
  role: "user" | "admin" = "user",
  audit: Partial<AuditApplication> = {},
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
        role,
      };
    }
  });
  await app.register(
    buildSecurityRoutes(
      iam as IamApplication,
      { name: "sid", options: { httpOnly: true, path: "/", sameSite: "lax" } },
      audit as AuditApplication,
      {
        listOwn: { execute: async () => Result.success([]) },
        listAdministrative: { execute: async () => Result.success([]) },
      },
    ),
  );
  await app.ready();
  return app;
}
describe("security HTTP application boundary", () => {
  // Compatibility expectations are independent of the production HTTP tables.
  const expectedFailures = [
    {
      capability: "accounts",
      operation: "requestRecovery",
      method: "POST",
      url: "/recovery",
      payload: { email: "alice@example.com" },
      errors: [["email.invalid_format", 400]],
    },
    {
      capability: "accounts",
      operation: "resetPassword",
      method: "POST",
      url: "/recovery/reset",
      payload: {
        token: "token",
        password: "password",
        passwordConfirmation: "password",
      },
      errors: [
        ["password_recovery.invalid_token", 400],
        ["password.confirmation_mismatch", 400],
        ["password.reused", 400],
        ["password.empty", 400],
        ["password.too_short", 400],
        ["password.too_long", 400],
        ["password.too_common", 400],
        ["password.compromised", 400],
        ["password.contextual", 400],
        ["password.too_weak", 400],
        ["password.uppercase_required", 400],
        ["password.lowercase_required", 400],
        ["password.number_required", 400],
        ["password.special_character_required", 400],
      ],
    },
    {
      capability: "authentication",
      operation: "completeMfaSignIn",
      method: "POST",
      url: "/mfa/challenge/verify",
      payload: { challengeId: "challenge", code: "123456" },
      errors: [
        ["mfa.invalid_challenge", 401],
        ["mfa.invalid_code", 401],
        ["mfa.not_enabled", 409],
      ],
    },
    {
      capability: "accounts",
      operation: "cancelDeletion",
      method: "POST",
      url: "/deletion/cancel",
      payload: { token: "token", password: "password", mfaCode: "123456" },
      errors: [
        ["account_deletion.invalid_token", 400],
        ["mfa.code_required", 400],
        ["authentication.invalid_credentials", 401],
        ["mfa.invalid_challenge", 401],
        ["mfa.invalid_code", 401],
        ["mfa.not_enabled", 409],
      ],
    },
    {
      capability: "authentication",
      operation: "beginMfaEnrollment",
      method: "POST",
      url: "/me/mfa/enrollment",
      payload: { password: "password" },
      errors: [
        ["authentication.invalid_credentials", 401],
        ["authentication.recent_proof_required", 401],
        ["mfa.unavailable", 403],
        ["user.not_found", 404],
        ["mfa.already_enabled", 409],
      ],
    },
    {
      capability: "authentication",
      operation: "confirmMfaEnrollment",
      method: "POST",
      url: "/me/mfa/enrollment/confirm",
      payload: { code: "123456" },
      errors: [
        ["mfa.invalid_enrollment", 400],
        ["mfa.invalid_code", 400],
      ],
    },
    {
      capability: "authentication",
      operation: "activateMfa",
      method: "POST",
      url: "/me/mfa/enrollment/backup-codes/confirm",
      payload: { confirmationId: "confirmation", backupCodesSaved: true },
      errors: [
        ["mfa.invalid_enrollment", 400],
        ["mfa.backup_codes_confirmation_required", 400],
      ],
    },
    {
      capability: "authentication",
      operation: "regenerateBackupCodes",
      method: "POST",
      url: "/me/mfa/backup-codes",
      payload: { password: "password", mfaCode: "123456" },
      errors: [
        ["authentication.invalid_credentials", 401],
        ["authentication.recent_proof_required", 401],
        ["mfa.invalid_challenge", 401],
        ["mfa.invalid_code", 401],
        ["mfa.not_enabled", 409],
      ],
    },
    {
      capability: "authentication",
      operation: "disableMfa",
      method: "DELETE",
      url: "/me/mfa",
      payload: { password: "password", mfaCode: "123456" },
      errors: [
        ["authentication.invalid_credentials", 401],
        ["authentication.recent_proof_required", 401],
        ["mfa.invalid_challenge", 401],
        ["mfa.invalid_code", 401],
        ["user.not_found", 404],
        ["mfa.not_enabled", 409],
        ["mfa.required_by_policy", 409],
        ["account.concurrent_modification", 409],
      ],
    },
    {
      capability: "accounts",
      operation: "requestExport",
      method: "POST",
      url: "/me/exports",
      payload: { password: "password", mfaCode: "123456" },
      errors: [
        ["mfa.code_required", 400],
        ["authentication.invalid_credentials", 401],
        ["authentication.recent_proof_required", 401],
        ["mfa.invalid_challenge", 401],
        ["mfa.invalid_code", 401],
        ["account_export.disabled", 403],
        ["user.not_found", 404],
        ["mfa.not_enabled", 409],
      ],
    },
    {
      capability: "accounts",
      operation: "downloadExport",
      method: "GET",
      url: "/me/exports/export-id/download",
      payload: undefined,
      errors: [["account_export.not_available", 404]],
    },
    {
      capability: "accounts",
      operation: "requestDeletion",
      method: "POST",
      url: "/me/deletion",
      payload: {
        password: "password",
        mfaCode: "123456",
        confirmation: "DELETE",
      },
      errors: [
        ["account_deletion.confirmation_required", 400],
        ["mfa.code_required", 400],
        ["authentication.invalid_credentials", 401],
        ["authentication.recent_proof_required", 401],
        ["mfa.invalid_challenge", 401],
        ["mfa.invalid_code", 401],
        ["account_deletion.disabled", 403],
        ["user.not_found", 404],
        ["mfa.not_enabled", 409],
        ["account.concurrent_modification", 409],
        ["administrator.last_active_access", 409],
      ],
    },
    {
      capability: "administration",
      operation: "getConfiguration",
      method: "GET",
      url: "/admin/security/config",
      payload: undefined,
      errors: [["administrator.unauthorized", 403]],
    },
    {
      capability: "administration",
      operation: "previewConfiguration",
      method: "POST",
      url: "/admin/security/config/preview",
      payload: { values: {} },
      errors: [
        ["administrator.unauthorized", 403],
        ["security_configuration.invalid", 400],
      ],
    },
    {
      capability: "administration",
      operation: "publishConfiguration",
      method: "PUT",
      url: "/admin/security/config",
      payload: { values: {}, expectedVersion: 1, justification: "test" },
      errors: [
        ["mfa.code_required", 400],
        ["security_configuration.invalid", 400],
        ["security_configuration.justification_required", 400],
        ["authentication.invalid_credentials", 401],
        ["authentication.recent_proof_required", 401],
        ["mfa.invalid_challenge", 401],
        ["mfa.invalid_code", 401],
        ["administrator.unauthorized", 403],
        ["mfa.not_enabled", 409],
        ["administrator.last_active_access", 409],
        ["security_configuration.critical_confirmation_required", 409],
        ["security_configuration.version_conflict", 409],
      ],
    },
    {
      capability: "administration",
      operation: "restoreConfiguration",
      method: "POST",
      url: "/admin/security/config/revision-id/rollback",
      payload: { expectedVersion: 1, justification: "test" },
      errors: [
        ["mfa.code_required", 400],
        ["security_configuration.invalid", 400],
        ["security_configuration.justification_required", 400],
        ["authentication.invalid_credentials", 401],
        ["authentication.recent_proof_required", 401],
        ["mfa.invalid_challenge", 401],
        ["mfa.invalid_code", 401],
        ["administrator.unauthorized", 403],
        ["security_configuration.revision_not_found", 404],
        ["mfa.not_enabled", 409],
        ["administrator.last_active_access", 409],
        ["security_configuration.critical_confirmation_required", 409],
        ["security_configuration.version_conflict", 409],
      ],
    },
  ] as const;

  it.each(
    expectedFailures.flatMap(({ errors, ...route }) =>
      errors.map(([code, status]) => ({ ...route, code, status })),
    ),
  )(
    "preserves $operation: $code -> $status",
    async ({ capability, operation, method, url, payload, code, status }) => {
      const execute = vi.fn(async () => Result.failure({ code }));
      const app = await server(
        { [capability]: { [operation]: { execute } } },
        true,
        "admin",
      );
      const response = await app.inject({
        method,
        url,
        ...(payload ? { payload } : {}),
      });
      expect(execute).toHaveBeenCalledOnce();
      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({ error: { code } });
      expect(response.headers["set-cookie"]).toBeUndefined();
    },
  );

  it.each([
    ["/me/exports", "account_export.disabled"],
    ["/me/deletion", "account_deletion.disabled"],
  ] as const)(
    "keeps disabled operations forbidden at %s",
    async (url, code) => {
      const execute = async () => ({
        success: false as const,
        error: { code },
      });
      const app = await server({
        accounts: {
          requestExport: { execute } as never,
          requestDeletion: { execute } as never,
        },
      });
      const response = await app.inject({
        method: "POST",
        url,
        payload: { password: "password", confirmation: "DELETE" },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: { code } });
    },
  );

  it("keeps the public capabilities envelope when the application returns a typed result", async () => {
    const capabilities = {
      publicRegistration: true,
      allowedLoginIdentifiers: ["email" as const],
      emailVerification: true,
      emailChange: true,
      sessionManagement: true,
      recovery: true,
      mfa: true,
      accountExport: true,
      accountDeletion: true,
    };
    const app = await server(
      {
        administration: {
          getCapabilities: {
            execute: async () => Result.success(capabilities),
          },
        },
      },
      false,
    );
    const response = await app.inject({ url: "/capabilities" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: capabilities });
  });
  it("preserves the enrollment-specific invalid-code status", async () => {
    const app = await server({
      authentication: {
        confirmMfaEnrollment: {
          execute: async () => Result.failure({ code: "mfa.invalid_code" }),
        } as never,
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/me/mfa/enrollment/confirm",
      payload: { code: "123456" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: "mfa.invalid_code" } });
  });
  it("presents a missing enrolled factor as a state conflict", async () => {
    const app = await server({
      authentication: {
        regenerateBackupCodes: {
          execute: async () => Result.failure({ code: "mfa.not_enabled" }),
        } as never,
      },
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
      app = await server({
        authentication: { activateMfa: { execute } as never },
      });
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
      app = await server(
        { authentication: { getMfaStatus: { execute } as never } },
        false,
      );
    const response = await app.inject({ url: "/me/mfa" });
    expect(response.statusCode).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });
  it("returns explicit password validation errors from recovery", async () => {
    const app = await server({
      accounts: {
        resetPassword: {
          execute: async () => Result.failure({ code: "password.compromised" }),
        } as never,
      },
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
  it.each([
    { code: "password.too_short" as const, actual: 3, min: 12 },
    { code: "password.too_long" as const, actual: 1025, max: 1024 },
    {
      code: "password.too_long" as const,
      actual: 129,
      max: 128,
      message: "Policy maximum exceeded",
    },
  ])("preserves $code and all diagnostic fields", async (error) => {
    const app = await server({
      accounts: {
        resetPassword: {
          execute: async () => ({ success: false as const, error }),
        },
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/recovery/reset",
      payload: { token: "token", password: "abc", passwordConfirmation: "abc" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error });
  });

  it.each([
    "unexpected.private_code",
    "administrator.unauthorized",
    "constructor",
    "__proto__",
  ])(
    "treats an out-of-contract result as a technical failure (%s)",
    async (code) => {
      const app = await server({
        accounts: {
          resetPassword: {
            execute: async () =>
              Result.failure({
                code,
                message: "private detail",
                token: "private token",
              }),
          } as never,
        },
      });
      const response = await app.inject({
        method: "POST",
        url: "/recovery/reset",
        payload: {
          token: "token",
          password: "password",
          passwordConfirmation: "password",
        },
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: {
          code: "internal.unexpected_error",
          message: "Internal server error",
        },
      });
      expect(response.body).not.toContain("private");
    },
  );

  it("does not accept a failure result from an operation whose error type is never", async () => {
    const app = await server({
      authentication: {
        getMfaStatus: {
          execute: async () => Result.failure({ code: "mfa.not_enabled" }),
        } as never,
      },
    });
    const response = await app.inject({ url: "/me/mfa" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: { code: "internal.unexpected_error" },
    });
  });

  it.each([
    {
      capability: "accounts",
      operation: "requestRecovery",
      value: undefined,
      status: 202,
      body: {
        data: {
          message:
            "If the account is eligible, recovery instructions will be sent.",
        },
      },
    },
    {
      capability: "accounts",
      operation: "resetPassword",
      value: undefined,
      status: 204,
      body: undefined,
    },
    {
      capability: "accounts",
      operation: "cancelDeletion",
      value: undefined,
      status: 204,
      body: undefined,
    },
    {
      capability: "authentication",
      operation: "beginMfaEnrollment",
      value: {
        secret: "setup",
        otpauthUri: "otpauth://setup",
        qrCodeDataUrl: "image",
        expiresAt: "2026-10-29T12:00:00.000Z",
      },
      status: 201,
      body: {
        data: {
          secret: "setup",
          otpauthUri: "otpauth://setup",
          qrCodeDataUrl: "image",
          expiresAt: "2026-10-29T12:00:00.000Z",
        },
      },
    },
    {
      capability: "authentication",
      operation: "confirmMfaEnrollment",
      value: { backupCodes: ["backup"], confirmationId: "confirmation" },
      status: 200,
      body: {
        data: { backupCodes: ["backup"], confirmationId: "confirmation" },
      },
    },
    {
      capability: "accounts",
      operation: "requestExport",
      value: { id: "export-id", status: "ready" },
      status: 202,
      body: { data: { id: "export-id", status: "ready" } },
    },
    {
      capability: "accounts",
      operation: "requestDeletion",
      value: { scheduledFor: "2026-11-29T12:00:00.000Z" },
      status: 202,
      body: { data: { scheduledFor: "2026-11-29T12:00:00.000Z" } },
    },
  ] as const)(
    "preserves the $operation success response",
    async ({ capability, operation, value, status, body }) => {
      const route = expectedFailures.find(
        (item) => item.operation === operation,
      );
      if (!route) {
        throw new Error("Missing success route fixture");
      }
      const app = await server({
        [capability]: {
          [operation]: { execute: async () => Result.success(value) },
        },
      });
      const response = await app.inject({
        method: route.method,
        url: route.url,
        ...(route.payload ? { payload: route.payload } : {}),
      });
      expect(response.statusCode).toBe(status);
      if (body === undefined) {
        expect(response.body).toBe("");
      } else {
        expect(response.json()).toEqual(body);
      }
      if (operation === "requestDeletion") {
        expect(response.headers["set-cookie"]).toContain("sid=;");
      } else {
        expect(response.headers["set-cookie"]).toBeUndefined();
      }
    },
  );

  it("preserves the ZIP body and download headers", async () => {
    const archive = new Uint8Array([80, 75, 3, 4, 0, 255]);
    const execute = vi.fn(async () => Result.success(archive));
    const app = await server({ accounts: { downloadExport: { execute } } });
    const response = await app.inject({
      url: "/me/exports/export-id/download",
    });
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(Buffer.from(archive));
    expect(response.headers["content-type"]).toBe("application/zip");
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="account-export-export-id.zip"',
    );
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(execute).toHaveBeenCalledWith({
      userId: "authoritative-actor",
      exportId: "export-id",
    });
  });

  it("preserves successful reads whose error types are never", async () => {
    const status = {
      enabled: true,
      enabledAt: new Date("2026-10-29T12:00:00Z"),
      backupCodesRemaining: 4,
      lowBackupCodes: false,
    };
    const app = await server({
      authentication: {
        getMfaStatus: { execute: async () => Result.success(status) },
      },
      accounts: { listExports: { execute: async () => Result.success([]) } },
    });
    const mfa = await app.inject({ url: "/me/mfa" });
    expect(mfa.statusCode).toBe(200);
    expect(mfa.json()).toEqual({
      data: { ...status, enabledAt: status.enabledAt.toISOString() },
    });
    const exports = await app.inject({ url: "/me/exports" });
    expect(exports.statusCode).toBe(200);
    expect(exports.json()).toEqual({ data: [] });
  });

  it("keeps administrator guards ahead of application error presentation", async () => {
    const execute = vi.fn();
    const app = await server({
      administration: { getConfiguration: { execute } },
    });
    const response = await app.inject({ url: "/admin/security/config" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { code: "authorization.forbidden" },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("preserves maintenance success and propagates unexpected purge failures", async () => {
    const purge = vi.fn(async () => 3);
    const app = await server(
      {
        accounts: {
          maintainAccounts: {
            execute: async () => Result.success({ deletedAccounts: 2 }),
          },
        },
      },
      true,
      "admin",
      { purge },
    );
    const success = await app.inject({
      method: "POST",
      url: "/admin/security/maintenance",
    });
    expect(success.statusCode).toBe(200);
    expect(success.json()).toEqual({
      data: { deletedAccounts: 2, purgedEvents: 3 },
    });
    purge.mockRejectedValueOnce(new Error("private storage failure"));
    const failure = await app.inject({
      method: "POST",
      url: "/admin/security/maintenance",
    });
    expect(failure.statusCode).toBe(500);
    expect(failure.json()).toEqual({
      error: {
        code: "internal.unexpected_error",
        message: "Internal server error",
      },
    });
    expect(failure.body).not.toContain("private storage failure");
  });

  it("does not convert an unexpected dependency failure into a business result", async () => {
    const app = await server({
      accounts: {
        resetPassword: {
          execute: async () => {
            throw new Error("storage failed");
          },
        } as never,
      },
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
      error: { code: "internal.unexpected_error" },
    });
    expect(response.body).not.toContain("storage failed");
  });
  it("issues a protected cookie only after successful MFA completion", async () => {
    const app = await server({
      authentication: {
        completeMfaSignIn: {
          execute: async () =>
            Result.success({
              sessionId: "credential",
              sessionExpiresAt: new Date(Date.now() + 60000),
              userId: "actor",
            }),
        } as never,
      },
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
      app = await server({ accounts: { resetPassword: { execute } as never } });
    const response = await app.inject({
      method: "POST",
      url: "/recovery/reset",
      payload: { token: "token" },
    });
    expect(response.statusCode).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
  it("reports an invalid email when schema validation rejects a missing recovery address", async () => {
    const execute = vi.fn(),
      app = await server({
        accounts: { requestRecovery: { execute } as never },
      });
    const response = await app.inject({
      method: "POST",
      url: "/recovery",
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "email.invalid_format" },
    });
    expect(execute).not.toHaveBeenCalled();
  });
  it("preserves the established recovery confirmation code", async () => {
    const app = await server({
      accounts: {
        resetPassword: {
          execute: async () =>
            Result.failure({ code: "password.confirmation_mismatch" }),
        } as never,
      },
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
      error: { code: "password.confirmation_mismatch" },
    });
  });
  it.each([true, false])(
    "clears the MFA cookie only on successful deactivation (%s)",
    async (success) => {
      const app = await server({
        authentication: {
          disableMfa: {
            execute: async () =>
              success
                ? Result.success(undefined)
                : Result.failure({ code: "mfa.invalid_code" }),
          } as never,
        },
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
    ["POST", "/mfa/challenge/verify", "mfa.invalid_challenge"],
    [
      "POST",
      "/deletion/cancel",
      "account_deletion.invalid_cancellation_request",
    ],
    ["POST", "/me/mfa/enrollment", "password.empty"],
    ["POST", "/me/mfa/enrollment/confirm", "mfa.code_required"],
    [
      "POST",
      "/me/mfa/enrollment/backup-codes/confirm",
      "mfa.backup_codes_confirmation_required",
    ],
    ["POST", "/me/mfa/backup-codes", "authentication.strong_proof_required"],
    ["DELETE", "/me/mfa", "authentication.strong_proof_required"],
    ["POST", "/me/exports", "password.empty"],
    ["POST", "/me/deletion", "account_deletion.invalid_request"],
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
