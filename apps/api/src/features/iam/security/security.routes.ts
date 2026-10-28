import type {
  AuditApplication,
  AuditEntry,
} from "@architecture/audit/application";
import type {
  IamResult,
  IamSecurityApplication,
  PublishedConfigurationReader,
  SecurityEventRecorder,
} from "@architecture/iam/application";
import type { CookieSerializeOptions } from "@fastify/cookie";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";
import { sessionMetadataFromRequest } from "#iam/sign-in/session-request-metadata";

import { SECURITY_CONFIG_CATALOG } from "./security-config.catalog.js";

export interface SecurityCookie {
  name: string;
  options: CookieSerializeOptions;
}
export function applicationResponse<T>(
  reply: FastifyReply,
  result: IamResult<T>,
  status = 200,
  errorStatuses: Readonly<Record<string, number>> = {},
) {
  if (!result.success) {
    const code = result.error.code;
    return reply
      .status(errorStatuses[code] ?? errorStatus(code))
      .send({ error: { ...result.error } });
  }
  return status === 204
    ? reply.status(204).send()
    : reply.status(status).send({ data: result.value });
}
function errorStatus(code: string) {
  if (
    ["administrator.unauthorized", "FORBIDDEN"].includes(code) ||
    code.endsWith("DISABLED") ||
    ["MFA_UNAVAILABLE", "MFA_ENROLLMENT_REQUIRED"].includes(code)
  ) {
    return 403;
  }
  if (
    [
      "UNAUTHORIZED",
      "INVALID_CREDENTIALS",
      "RECENT_AUTHENTICATION_REQUIRED",
      "MFA_CHALLENGE_INVALID",
      "MFA_CODE_INVALID",
    ].includes(code)
  ) {
    return 401;
  }
  if (
    [
      "EXPORT_NOT_AVAILABLE",
      "CONFIG_REVISION_NOT_FOUND",
      "USER_NOT_FOUND",
    ].includes(code)
  ) {
    return 404;
  }
  if (
    [
      "CONFIG_VERSION_CONFLICT",
      "CONFIG_CRITICAL_CONFIRMATION_REQUIRED",
      "LAST_ACTIVE_ADMIN",
      "ACCOUNT_CONCURRENT_MODIFICATION",
      "MFA_ALREADY_ENABLED",
      "MFA_NOT_ENABLED",
      "MFA_REQUIRED_BY_POLICY",
    ].includes(code)
  ) {
    return 409;
  }
  return 400;
}
const authentication = Type.Object({
  password: Type.String({ maxLength: 1024 }),
  mfaCode: Type.Optional(Type.String()),
});
type AuthenticationBody = Static<typeof authentication>;
function actor(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED" } });
    return null;
  }
  return request.auth;
}
function requestContext(request: FastifyRequest) {
  return {
    actorType: "anonymous" as const,
    correlationId: String(request.id),
    ipAddress: request.ip,
    ...(request.headers["user-agent"]
      ? { client: request.headers["user-agent"] }
      : {}),
  };
}
function auditResponse(entry: AuditEntry) {
  return {
    id: entry.id,
    type: entry.type,
    occurred_at: entry.occurredAt,
    result: entry.result,
    actor_type: entry.actorType,
    actor_id: entry.actorId,
    subject_id: entry.subjectId,
    correlation_id: entry.correlationId,
    client: entry.client,
    metadata: entry.metadata,
  };
}

export function buildSecurityRoutes(
  security: IamSecurityApplication,
  cookie: SecurityCookie,
  audit: AuditApplication,
  configuration: PublishedConfigurationReader,
  events: SecurityEventRecorder,
) {
  return async (app: FastifyInstance) => {
    app.get("/capabilities", async (_request, reply) =>
      reply.send({ data: await security.getCapabilities.execute() }),
    );
    const recovery = Type.Object({ email: Type.String() });
    app.post<{ Body: Static<typeof recovery> }>(
      "/recovery",
      { schema: { body: recovery } },
      async (request, reply) => {
        const result = await security.requestRecovery.execute({
          email: request.body.email,
          context: requestContext(request),
        });
        return result.success
          ? reply.status(202).send({
              data: {
                message:
                  "If the account is eligible, recovery instructions will be sent.",
              },
            })
          : applicationResponse(reply, result);
      },
    );
    const reset = Type.Object({
      token: Type.String(),
      password: Type.String({ maxLength: 1024 }),
      passwordConfirmation: Type.String({ maxLength: 1024 }),
    });
    app.post<{ Body: Static<typeof reset> }>(
      "/recovery/reset",
      { schema: { body: reset } },
      async (request, reply) =>
        applicationResponse(
          reply,
          await security.resetPassword.execute({
            ...request.body,
            context: requestContext(request),
          }),
          204,
        ),
    );
    const challenge = Type.Object({
      challengeId: Type.String(),
      code: Type.String(),
    });
    app.post<{ Body: Static<typeof challenge> }>(
      "/mfa/challenge/verify",
      { schema: { body: challenge } },
      async (request, reply) => {
        const result = await security.completeMfaSignIn.execute({
          ...request.body,
          metadata: sessionMetadataFromRequest(request),
        });
        if (!result.success) {
          return applicationResponse(reply, result);
        }
        reply.setCookie(cookie.name, result.value.sessionId, {
          ...cookie.options,
          maxAge: Math.max(
            1,
            Math.floor(
              (result.value.sessionExpiresAt.getTime() - Date.now()) / 1000,
            ),
          ),
        });
        return reply.status(204).send();
      },
    );
    const cancellation = Type.Intersect([
      authentication,
      Type.Object({ token: Type.String() }),
    ]);
    app.post<{ Body: Static<typeof cancellation> }>(
      "/deletion/cancel",
      { schema: { body: cancellation } },
      async (request, reply) =>
        applicationResponse(
          reply,
          await security.cancelDeletion.execute({
            token: request.body.token,
            password: request.body.password,
            ...(request.body.mfaCode ? { code: request.body.mfaCode } : {}),
          }),
          204,
        ),
    );

    await app.register(async (protectedApp) => {
      const { authenticate } = protectedApp as AuthenticatedFastifyInstance;
      protectedApp.addHook("preHandler", authenticate);
      protectedApp.get("/me/mfa", async (request, reply) => {
        const auth = actor(request, reply);
        if (!auth) {
          return reply;
        }
        return applicationResponse(
          reply,
          await security.getMfaStatus.execute({ userId: auth.userId }),
        );
      });
      protectedApp.post<{ Body: AuthenticationBody }>(
        "/me/mfa/enrollment",
        { schema: { body: authentication } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await security.beginMfaEnrollment.execute({
              userId: auth.userId,
              sessionId: auth.sessionId,
              password: request.body.password,
            }),
            201,
          );
        },
      );
      const confirmation = Type.Object({ code: Type.String() });
      protectedApp.post<{ Body: Static<typeof confirmation> }>(
        "/me/mfa/enrollment/confirm",
        { schema: { body: confirmation } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await security.confirmMfaEnrollment.execute({
              userId: auth.userId,
              code: request.body.code,
            }),
            200,
            { MFA_CODE_INVALID: 400 },
          );
        },
      );
      const saved = Type.Object({
        confirmationId: Type.String(),
        backupCodesSaved: Type.Boolean(),
      });
      protectedApp.post<{ Body: Static<typeof saved> }>(
        "/me/mfa/enrollment/backup-codes/confirm",
        { schema: { body: saved } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await security.activateMfa.execute({
              ...request.body,
              userId: auth.userId,
            }),
            204,
          );
        },
      );
      const strong = Type.Object({
        password: Type.String({ maxLength: 1024 }),
        mfaCode: Type.String(),
      });
      protectedApp.post<{ Body: Static<typeof strong> }>(
        "/me/mfa/backup-codes",
        { schema: { body: strong } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await security.regenerateBackupCodes.execute({
              userId: auth.userId,
              sessionId: auth.sessionId,
              password: request.body.password,
              code: request.body.mfaCode,
            }),
          );
        },
      );
      protectedApp.delete<{ Body: Static<typeof strong> }>(
        "/me/mfa",
        { schema: { body: strong } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await security.disableMfa.execute({
              userId: auth.userId,
              sessionId: auth.sessionId,
              password: request.body.password,
              code: request.body.mfaCode,
            }),
            204,
          );
        },
      );
      protectedApp.post<{ Body: AuthenticationBody }>(
        "/me/exports",
        { schema: { body: authentication } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await security.requestExport.execute({
              userId: auth.userId,
              sessionId: auth.sessionId,
              password: request.body.password,
              ...(request.body.mfaCode ? { code: request.body.mfaCode } : {}),
            }),
            202,
          );
        },
      );
      protectedApp.get("/me/exports", async (request, reply) => {
        const auth = actor(request, reply);
        if (!auth) {
          return reply;
        }
        return applicationResponse(
          reply,
          await security.listExports.execute({ userId: auth.userId }),
        );
      });
      const exportParams = Type.Object({ exportId: Type.String() });
      protectedApp.get<{ Params: Static<typeof exportParams> }>(
        "/me/exports/:exportId/download",
        { schema: { params: exportParams } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          const result = await security.downloadExport.execute({
            userId: auth.userId,
            exportId: request.params.exportId,
          });
          if (!result.success) {
            return applicationResponse(reply, result);
          }
          return reply
            .header("content-type", "application/zip")
            .header(
              "content-disposition",
              `attachment; filename="account-export-${request.params.exportId}.zip"`,
            )
            .header("cache-control", "no-store")
            .send(Buffer.from(result.value));
        },
      );
      const deletion = Type.Intersect([
        authentication,
        Type.Object({ confirmation: Type.String() }),
      ]);
      protectedApp.post<{ Body: Static<typeof deletion> }>(
        "/me/deletion",
        { schema: { body: deletion } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          const result = await security.requestDeletion.execute({
            userId: auth.userId,
            sessionId: auth.sessionId,
            password: request.body.password,
            confirmation: request.body.confirmation,
            ...(request.body.mfaCode ? { code: request.body.mfaCode } : {}),
          });
          if (result.success) {
            reply.clearCookie(cookie.name, cookie.options);
          }
          return applicationResponse(reply, result, 202);
        },
      );
      protectedApp.get<{ Querystring: { page?: number; pageSize?: number } }>(
        "/me/security-events",
        {
          schema: {
            querystring: Type.Object({
              page: Type.Optional(Type.Integer({ minimum: 1 })),
              pageSize: Type.Optional(
                Type.Integer({ minimum: 1, maximum: 100 }),
              ),
            }),
          },
        },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          if (
            !(await configuration.readPublished()).values.audit.consultation
          ) {
            return reply
              .status(403)
              .send({ error: { code: "AUDIT_CONSULTATION_DISABLED" } });
          }
          return reply.send({
            data: (
              await audit.listOwn(
                auth.userId,
                request.query.page ?? 1,
                request.query.pageSize ?? 25,
              )
            ).map(auditResponse),
          });
        },
      );
    });

    await app.register(async (admin) => {
      const { authenticate } = admin as AuthenticatedFastifyInstance;
      admin.addHook("preHandler", authenticate);
      admin.addHook("preHandler", async (request, reply) => {
        if (request.auth?.role !== "admin") {
          return reply.status(403).send({ error: { code: "FORBIDDEN" } });
        }
      });
      admin.get("/admin/security/config", async (request, reply) => {
        const auth = actor(request, reply);
        if (!auth) {
          return reply;
        }
        const result = await security.getConfiguration.execute(auth.userId);
        if (!result.success) {
          return applicationResponse(reply, result);
        }
        return reply.send({
          data: {
            catalog: SECURITY_CONFIG_CATALOG,
            effective: result.value.effective,
            effectiveRevision: result.value.effectiveRevision,
            revisions: result.value.revisions.map((revision) => ({
              id: revision.id,
              version: revision.version,
              status:
                revision.version === result.value.revisions[0]?.version
                  ? "published"
                  : "superseded",
              created_by: revision.createdBy,
              created_at: revision.createdAt,
              published_at: revision.createdAt,
              previous_revision_id: revision.previousRevisionId,
            })),
          },
        });
      });
      const publication = Type.Object({
        values: Type.Unknown(),
        expectedVersion: Type.Integer({ minimum: 1 }),
        justification: Type.String(),
        confirmedCritical: Type.Optional(Type.Boolean()),
      });
      admin.put<{ Body: Static<typeof publication> }>(
        "/admin/security/config",
        { schema: { body: publication } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await security.publishConfiguration.execute({
              actorId: auth.userId,
              values: request.body.values,
              expectedVersion: request.body.expectedVersion,
              justification: request.body.justification,
              confirmedCritical: request.body.confirmedCritical === true,
            }),
          );
        },
      );
      const preview = Type.Object({ values: Type.Unknown() });
      admin.post<{ Body: Static<typeof preview> }>(
        "/admin/security/config/preview",
        { schema: { body: preview } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          const result = await security.previewConfiguration.execute({
            actorId: auth.userId,
            values: request.body.values,
          });
          if (!result.success) {
            return applicationResponse(reply, result);
          }
          return applicationResponse(reply, result);
        },
      );
      const revision = Type.Object({ revisionId: Type.String() });
      admin.post<{ Params: Static<typeof revision> }>(
        "/admin/security/config/:revisionId/rollback",
        { schema: { params: revision } },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await security.restoreConfiguration.execute({
              actorId: auth.userId,
              revisionId: request.params.revisionId,
            }),
          );
        },
      );
      admin.get<{ Querystring: Record<string, string | undefined> }>(
        "/admin/security-events",
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          const q = request.query;
          const filters = {
            page: Number(q["page"]) || 1,
            pageSize: Math.min(100, Number(q["pageSize"]) || 25),
            ...(q["type"] ? { type: q["type"] } : {}),
            ...(q["result"] ? { result: q["result"] } : {}),
            ...(q["actorId"] ? { actorId: q["actorId"] } : {}),
            ...(q["subjectId"] ? { subjectId: q["subjectId"] } : {}),
            ...(q["correlationId"]
              ? { correlationId: q["correlationId"] }
              : {}),
            ...(q["from"] ? { from: new Date(q["from"]) } : {}),
            ...(q["to"] ? { to: new Date(q["to"]) } : {}),
          };
          const rows = await audit.list(filters);
          await events.record(
            "security.audit.consulted",
            "success",
            {
              actorType: "administrator",
              actorId: auth.userId,
              subjectId: auth.userId,
            },
            { filters },
          );
          return reply.send({ data: rows.map(auditResponse) });
        },
      );
      admin.post("/admin/security/maintenance", async (request, reply) => {
        if (!actor(request, reply)) {
          return reply;
        }
        const result = await security.maintainAccounts.execute();
        if (!result.success) {
          return applicationResponse(reply, result);
        }
        return reply.send({
          data: {
            ...result.value,
            purgedEvents: await audit.purge(new Date()),
          },
        });
      });
    });
  };
}
