import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";
import { sessionMetadataFromRequest } from "#iam/sign-in/session-request-metadata";

import { SecurityError, type SecurityService } from "./security.service.js";

interface SecurityCookie {
  name: string;
  options: CookieSerializeOptions;
}

interface AuthenticationBody {
  password: string;
  mfaCode?: string;
}

export function buildSecurityRoutes(
  security: SecurityService,
  sessionCookie: SecurityCookie,
) {
  return async (app: FastifyInstance) => {
    app.get("/capabilities", async (_request, reply) =>
      safely(reply, async () => ({
        status: 200,
        data: await security.publicCapabilities(),
      })),
    );

    app.post("/recovery", async (request, reply) =>
      safely(reply, async () => {
        const body = request.body as { email?: string };
        if (typeof body.email !== "string") {
          throw new SecurityError("EMAIL_INVALID");
        }
        await security.requestRecovery(body.email, requestContext(request));
        return {
          status: 202,
          data: {
            message:
              "If the account is eligible, recovery instructions will be sent.",
          },
        };
      }),
    );

    app.post("/recovery/reset", async (request, reply) =>
      safely(reply, async () => {
        const body = request.body as {
          token?: string;
          password?: string;
          passwordConfirmation?: string;
        };
        if (
          typeof body.token !== "string" ||
          typeof body.password !== "string" ||
          typeof body.passwordConfirmation !== "string"
        ) {
          throw new SecurityError("RECOVERY_REQUEST_INVALID");
        }
        await security.resetPassword(
          body.token,
          body.password,
          body.passwordConfirmation,
          requestContext(request),
        );
        return { status: 204 };
      }),
    );

    app.post("/mfa/challenge/verify", async (request, reply) =>
      safely(reply, async () => {
        const body = request.body as { challengeId?: string; code?: string };
        if (
          typeof body.challengeId !== "string" ||
          typeof body.code !== "string"
        ) {
          throw new SecurityError("MFA_CHALLENGE_INVALID");
        }
        const metadata = sessionMetadataFromRequest(request);
        const session = await security.completeMfaSignIn(
          body.challengeId,
          body.code,
          metadata,
        );
        reply.setCookie(sessionCookie.name, session.sessionId, {
          ...sessionCookie.options,
          maxAge: Math.max(
            1,
            Math.floor(
              (session.sessionExpiresAt.getTime() - Date.now()) / 1000,
            ),
          ),
        });
        return { status: 204 };
      }),
    );

    app.post("/deletion/cancel", async (request, reply) =>
      safely(reply, async () => {
        const body = request.body as {
          token?: string;
          password?: string;
          mfaCode?: string;
        };
        if (
          typeof body.token !== "string" ||
          typeof body.password !== "string"
        ) {
          throw new SecurityError("DELETION_CANCELLATION_INVALID");
        }
        await security.cancelDeletion(body.token, body.password, body.mfaCode);
        return { status: 204 };
      }),
    );

    await app.register(async (protectedApp) => {
      const { authenticate } = protectedApp as AuthenticatedFastifyInstance;
      protectedApp.addHook("preHandler", authenticate);

      protectedApp.get("/me/security-events", async (request, reply) =>
        safely(reply, async () => {
          const query = request.query as { page?: string; pageSize?: string };
          return {
            status: 200,
            data: await security.listOwnAudit(
              requireAuth(request).userId,
              numberOr(query.page, 1),
              numberOr(query.pageSize, 25),
            ),
          };
        }),
      );

      protectedApp.get("/me/mfa", async (request, reply) =>
        safely(reply, async () => ({
          status: 200,
          data: await security.mfaStatus(requireAuth(request).userId),
        })),
      );

      protectedApp.post("/me/mfa/enrollment", async (request, reply) =>
        safely(reply, async () => {
          const body = request.body as AuthenticationBody;
          if (typeof body.password !== "string") {
            throw new SecurityError("PASSWORD_REQUIRED");
          }
          const auth = requireAuth(request);
          return {
            status: 201,
            data: await security.beginMfaEnrollment(
              auth.userId,
              auth.sessionId,
              body.password,
            ),
          };
        }),
      );

      protectedApp.post("/me/mfa/enrollment/confirm", async (request, reply) =>
        safely(reply, async () => {
          const body = request.body as { code?: string };
          if (typeof body.code !== "string") {
            throw new SecurityError("MFA_CODE_REQUIRED");
          }
          return {
            status: 200,
            data: await security.confirmMfaEnrollment(
              requireAuth(request).userId,
              body.code,
            ),
          };
        }),
      );

      protectedApp.post(
        "/me/mfa/enrollment/backup-codes/confirm",
        async (request, reply) =>
          safely(reply, async () => {
            const body = request.body as {
              confirmationId?: string;
              backupCodesSaved?: boolean;
            };
            if (
              typeof body.confirmationId !== "string" ||
              body.backupCodesSaved !== true
            ) {
              throw new SecurityError("MFA_BACKUP_CODES_CONFIRMATION_REQUIRED");
            }
            await security.finalizeMfaEnrollment(
              requireAuth(request).userId,
              body.confirmationId,
              body.backupCodesSaved,
            );
            return { status: 204 };
          }),
      );

      protectedApp.post("/me/mfa/backup-codes", async (request, reply) =>
        safely(reply, async () => {
          const body = request.body as AuthenticationBody;
          if (
            typeof body.password !== "string" ||
            typeof body.mfaCode !== "string"
          ) {
            throw new SecurityError("STRONG_AUTHENTICATION_REQUIRED");
          }
          const auth = requireAuth(request);
          return {
            status: 200,
            data: await security.regenerateBackupCodes(
              auth.userId,
              auth.sessionId,
              body.password,
              body.mfaCode,
            ),
          };
        }),
      );

      protectedApp.delete("/me/mfa", async (request, reply) =>
        safely(reply, async () => {
          const body = request.body as AuthenticationBody;
          if (
            typeof body.password !== "string" ||
            typeof body.mfaCode !== "string"
          ) {
            throw new SecurityError("STRONG_AUTHENTICATION_REQUIRED");
          }
          const auth = requireAuth(request);
          await security.disableMfa(
            auth.userId,
            auth.sessionId,
            body.password,
            body.mfaCode,
          );
          reply.clearCookie(sessionCookie.name, sessionCookie.options);
          return { status: 204 };
        }),
      );

      protectedApp.post("/me/exports", async (request, reply) =>
        safely(reply, async () => {
          const body = request.body as AuthenticationBody;
          if (typeof body.password !== "string") {
            throw new SecurityError("PASSWORD_REQUIRED");
          }
          const auth = requireAuth(request);
          return {
            status: 202,
            data: await security.requestExport(
              auth.userId,
              auth.sessionId,
              body.password,
              body.mfaCode,
            ),
          };
        }),
      );

      protectedApp.get("/me/exports", async (request, reply) =>
        safely(reply, async () => ({
          status: 200,
          data: await security.listExports(requireAuth(request).userId),
        })),
      );

      protectedApp.get(
        "/me/exports/:exportId/download",
        async (request, reply) =>
          safely(reply, async () => {
            const parameters = request.params as { exportId: string };
            const archive = await security.downloadExport(
              requireAuth(request).userId,
              parameters.exportId,
            );
            reply
              .header("content-type", "application/zip")
              .header(
                "content-disposition",
                `attachment; filename="account-export-${parameters.exportId}.zip"`,
              )
              .header("cache-control", "no-store");
            return { status: 200, raw: archive };
          }),
      );

      protectedApp.post("/me/deletion", async (request, reply) =>
        safely(reply, async () => {
          const body = request.body as AuthenticationBody & {
            confirmation?: string;
          };
          if (
            typeof body.password !== "string" ||
            typeof body.confirmation !== "string"
          ) {
            throw new SecurityError("DELETION_REQUEST_INVALID");
          }
          const auth = requireAuth(request);
          const result = await security.requestDeletion(
            auth.userId,
            auth.sessionId,
            body.password,
            body.confirmation,
            body.mfaCode,
          );
          reply.clearCookie(sessionCookie.name, sessionCookie.options);
          return { status: 202, data: result };
        }),
      );
    });

    await app.register(async (adminApp) => {
      const { authenticate } = adminApp as AuthenticatedFastifyInstance;
      adminApp.addHook("preHandler", authenticate);
      adminApp.addHook("preHandler", async (request, reply) => {
        if (request.auth?.role !== "admin") {
          return reply.status(403).send({ error: { code: "FORBIDDEN" } });
        }
      });

      adminApp.get("/admin/security/config", async (_request, reply) =>
        safely(reply, async () => ({
          status: 200,
          data: await security.configCenter(),
        })),
      );

      adminApp.put("/admin/security/config", async (request, reply) =>
        safely(reply, async () => {
          const body = request.body as {
            values?: unknown;
            expectedVersion?: number;
            justification?: string;
            confirmedCritical?: boolean;
          };
          if (
            body.values === undefined ||
            typeof body.expectedVersion !== "number" ||
            typeof body.justification !== "string"
          ) {
            throw new SecurityError("CONFIG_INVALID");
          }
          return {
            status: 200,
            data: await security.publishPolicy(
              requireAuth(request).userId,
              body.values,
              body.expectedVersion,
              body.justification,
              body.confirmedCritical === true,
            ),
          };
        }),
      );

      adminApp.post("/admin/security/config/preview", async (request, reply) =>
        safely(reply, async () => {
          const body = request.body as { values?: unknown };
          if (body.values === undefined) {
            throw new SecurityError("CONFIG_INVALID");
          }
          return {
            status: 200,
            data: await security.previewPolicy(body.values),
          };
        }),
      );

      adminApp.post(
        "/admin/security/config/:revisionId/rollback",
        async (request, reply) =>
          safely(reply, async () => ({
            status: 200,
            data: await security.rollbackPolicy(
              requireAuth(request).userId,
              (request.params as { revisionId: string }).revisionId,
            ),
          })),
      );

      adminApp.get("/admin/security-events", async (request, reply) =>
        safely(reply, async () => {
          const query = request.query as Record<string, string | undefined>;
          return {
            status: 200,
            data: await security.listAdminAudit(requireAuth(request).userId, {
              page: numberOr(query["page"], 1),
              pageSize: numberOr(query["pageSize"], 25),
              ...(query["type"] ? { type: query["type"] } : {}),
              ...(query["result"] ? { result: query["result"] } : {}),
              ...(query["actorId"] ? { actorId: query["actorId"] } : {}),
              ...(query["subjectId"] ? { subjectId: query["subjectId"] } : {}),
              ...(query["correlationId"]
                ? { correlationId: query["correlationId"] }
                : {}),
              ...(query["from"] ? { from: new Date(query["from"]) } : {}),
              ...(query["to"] ? { to: new Date(query["to"]) } : {}),
            }),
          };
        }),
      );

      adminApp.post("/admin/security/maintenance", async (_request, reply) =>
        safely(reply, async () => ({
          status: 200,
          data: await security.processMaintenance(),
        })),
      );
    });
  };
}

function requireAuth(request: FastifyRequest) {
  if (!request.auth) {
    throw new SecurityError("UNAUTHORIZED", 401);
  }
  return request.auth;
}

function requestContext(request: FastifyRequest) {
  return {
    actorType: "anonymous" as const,
    correlationId:
      typeof request.id === "string" ? request.id : String(request.id),
    ipAddress: request.ip,
    ...(request.headers["user-agent"]
      ? { client: request.headers["user-agent"] }
      : {}),
  };
}

function numberOr(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function safely(
  reply: FastifyReply,
  operation: () => Promise<{
    status: number;
    data?: unknown;
    raw?: Buffer;
  }>,
) {
  try {
    const response = await operation();
    if (response.raw) {
      return reply.status(response.status).send(response.raw);
    }
    if (response.status === 204) {
      return reply.status(204).send();
    }
    return reply.status(response.status).send({ data: response.data });
  } catch (error) {
    if (error instanceof SecurityError) {
      return reply.status(error.status).send({ error: { code: error.code } });
    }
    throw error;
  }
}
