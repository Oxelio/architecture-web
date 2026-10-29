import type {
  AuditApplication,
  AuditEntry,
} from "@architecture/audit/application";
import type {
  IamApplication,
  PublishedConfigurationReader,
  SecurityEventRecorder,
} from "@architecture/iam/application";
import type { CookieSerializeOptions } from "@fastify/cookie";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";
import { sessionMetadataFromRequest } from "#iam/sign-in/session-request-metadata";
import type {
  HttpErrorDefinitions,
  HttpSuccessStatus,
} from "#types/http.types";

import {
  ActivateMfaHttpErrors,
  BeginMfaEnrollmentHttpErrors,
  CancelAccountDeletionHttpErrors,
  CompleteMfaSignInHttpErrors,
  ConfirmMfaEnrollmentHttpErrors,
  DisableMfaHttpErrors,
  DownloadAccountExportHttpErrors,
  GetSecurityConfigurationHttpErrors,
  PreviewSecurityConfigurationHttpErrors,
  PublishSecurityConfigurationHttpErrors,
  RegenerateMfaBackupCodesHttpErrors,
  RequestAccountDeletionHttpErrors,
  RequestAccountExportHttpErrors,
  RequestPasswordRecoveryHttpErrors,
  ResetRecoveredPasswordHttpErrors,
  RestoreSecurityConfigurationHttpErrors,
} from "./security.http.js";
import { SECURITY_CONFIG_CATALOG } from "./security-config.catalog.js";

export interface SecurityCookie {
  name: string;
  options: CookieSerializeOptions;
}
export function applicationResponse<T, E extends { readonly code: string }>(
  reply: FastifyReply,
  result:
    | { readonly success: true; readonly value: T }
    | { readonly success: false; readonly error: E },
  errors: HttpErrorDefinitions<NoInfer<E["code"]>>,
  status: HttpSuccessStatus = 200,
) {
  if (!result.success) {
    const code: E["code"] = result.error.code;
    if (!Object.hasOwn(errors, code)) {
      throw new Error("Unexpected IAM application error");
    }
    return reply
      .status(errors[code].status)
      .send({ error: { ...result.error } });
  }
  return status === 204
    ? reply.status(204).send()
    : reply.status(status).send({ data: result.value });
}
const authentication = Type.Object({
  password: Type.String({ maxLength: 1024 }),
  mfaCode: Type.Optional(Type.String()),
});
type AuthenticationBody = Static<typeof authentication>;
function actor(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) {
    reply.status(401).send({ error: { code: "authentication.unauthorized" } });
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
  iam: IamApplication,
  cookie: SecurityCookie,
  audit: AuditApplication,
  configuration: PublishedConfigurationReader,
  events: SecurityEventRecorder,
) {
  return async (app: FastifyInstance) => {
    const errorEnvelope = Type.Object({
      error: Type.Object(
        { code: Type.String(), message: Type.Optional(Type.String()) },
        { additionalProperties: true },
      ),
    });
    app.addHook("onRoute", (options) => {
      options.schema = {
        ...options.schema,
        response: {
          400: errorEnvelope,
          401: errorEnvelope,
          403: errorEnvelope,
          404: errorEnvelope,
          409: errorEnvelope,
          500: errorEnvelope,
          ...(typeof options.schema?.response === "object"
            ? options.schema.response
            : {}),
        },
      };
    });
    const inheritedErrorHandler = app.errorHandler;
    app.setErrorHandler(function (error, request, reply) {
      if (error instanceof Error && "validation" in error && error.validation) {
        const path = request.routeOptions.url?.replace(
          /^.*?(?=\/(?:recovery|mfa|deletion|me|admin)(?:\/|$))/,
          "",
        );
        const codes: Record<string, string> = {
          "/recovery": "email.invalid_format",
          "/recovery/reset": "password_recovery.invalid_request",
          "/mfa/challenge/verify": "mfa.invalid_challenge",
          "/deletion/cancel": "account_deletion.invalid_cancellation_request",
          "/me/mfa/enrollment": "password.empty",
          "/me/mfa/enrollment/confirm": "mfa.code_required",
          "/me/mfa/enrollment/backup-codes/confirm":
            "mfa.backup_codes_confirmation_required",
          "/me/mfa/backup-codes": "authentication.strong_proof_required",
          "/me/mfa": "authentication.strong_proof_required",
          "/me/exports": "password.empty",
          "/me/deletion": "account_deletion.invalid_request",
          "/admin/security/config": "security_configuration.invalid",
          "/admin/security/config/preview": "security_configuration.invalid",
        };
        let code = path ? codes[path] : undefined;
        const body = request.body as Record<string, unknown> | null;
        if (
          path === "/recovery/reset" &&
          body &&
          typeof body["token"] === "string" &&
          typeof body["password"] === "string" &&
          typeof body["passwordConfirmation"] === "string"
        ) {
          code =
            body["password"] !== body["passwordConfirmation"]
              ? "password.confirmation_mismatch"
              : "password.policy_violation";
        }
        if (code) {
          return reply.status(400).send({ error: { code } });
        }
      }
      return inheritedErrorHandler.call(this, error, request, reply);
    });
    app.get("/capabilities", async (_request, reply) =>
      applicationResponse(
        reply,
        await iam.administration.getCapabilities.execute(),
        {},
      ),
    );
    const recovery = Type.Object({ email: Type.String() });
    app.post<{ Body: Static<typeof recovery> }>(
      "/recovery",
      { schema: { body: recovery } },
      async (request, reply) => {
        const result = await iam.accounts.requestRecovery.execute({
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
          : applicationResponse(
              reply,
              result,
              RequestPasswordRecoveryHttpErrors,
            );
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
      async (request, reply) => {
        const result = await iam.accounts.resetPassword.execute({
          ...request.body,
          context: requestContext(request),
        });
        return applicationResponse(
          reply,
          result,
          ResetRecoveredPasswordHttpErrors,
          204,
        );
      },
    );
    const challenge = Type.Object({
      challengeId: Type.String(),
      code: Type.String(),
    });
    app.post<{ Body: Static<typeof challenge> }>(
      "/mfa/challenge/verify",
      { schema: { body: challenge } },
      async (request, reply) => {
        const result = await iam.authentication.completeMfaSignIn.execute({
          ...request.body,
          metadata: sessionMetadataFromRequest(request),
        });
        if (!result.success) {
          return applicationResponse(
            reply,
            result,
            CompleteMfaSignInHttpErrors,
          );
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
          await iam.accounts.cancelDeletion.execute({
            token: request.body.token,
            password: request.body.password,
            ...(request.body.mfaCode ? { code: request.body.mfaCode } : {}),
          }),
          CancelAccountDeletionHttpErrors,
          204,
        ),
    );

    await app.register(async (protectedApp) => {
      const { authenticate } = protectedApp as AuthenticatedFastifyInstance;
      protectedApp.addHook("preValidation", authenticate);
      protectedApp.get("/me/mfa", async (request, reply) => {
        const auth = actor(request, reply);
        if (!auth) {
          return reply;
        }
        return applicationResponse(
          reply,
          await iam.authentication.getMfaStatus.execute({
            userId: auth.userId,
          }),
          {},
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
            await iam.authentication.beginMfaEnrollment.execute({
              userId: auth.userId,
              sessionId: auth.sessionId,
              password: request.body.password,
            }),
            BeginMfaEnrollmentHttpErrors,
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
            await iam.authentication.confirmMfaEnrollment.execute({
              userId: auth.userId,
              code: request.body.code,
            }),
            ConfirmMfaEnrollmentHttpErrors,
            200,
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
            await iam.authentication.activateMfa.execute({
              ...request.body,
              userId: auth.userId,
            }),
            ActivateMfaHttpErrors,
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
            await iam.authentication.regenerateBackupCodes.execute({
              userId: auth.userId,
              sessionId: auth.sessionId,
              password: request.body.password,
              code: request.body.mfaCode,
            }),
            RegenerateMfaBackupCodesHttpErrors,
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
          const result = await iam.authentication.disableMfa.execute({
            userId: auth.userId,
            sessionId: auth.sessionId,
            password: request.body.password,
            code: request.body.mfaCode,
          });
          if (result.success) {
            reply.clearCookie(cookie.name, cookie.options);
          }
          return applicationResponse(reply, result, DisableMfaHttpErrors, 204);
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
            await iam.accounts.requestExport.execute({
              userId: auth.userId,
              sessionId: auth.sessionId,
              password: request.body.password,
              ...(request.body.mfaCode ? { code: request.body.mfaCode } : {}),
            }),
            RequestAccountExportHttpErrors,
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
          await iam.accounts.listExports.execute({ userId: auth.userId }),
          {},
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
          const result = await iam.accounts.downloadExport.execute({
            userId: auth.userId,
            exportId: request.params.exportId,
          });
          if (!result.success) {
            return applicationResponse(
              reply,
              result,
              DownloadAccountExportHttpErrors,
            );
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
          const result = await iam.accounts.requestDeletion.execute({
            userId: auth.userId,
            sessionId: auth.sessionId,
            password: request.body.password,
            confirmation: request.body.confirmation,
            ...(request.body.mfaCode ? { code: request.body.mfaCode } : {}),
          });
          if (result.success) {
            reply.clearCookie(cookie.name, cookie.options);
          }
          return applicationResponse(
            reply,
            result,
            RequestAccountDeletionHttpErrors,
            202,
          );
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
              .send({ error: { code: "audit_consultation.disabled" } });
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
      admin.addHook("preValidation", authenticate);
      admin.addHook("preValidation", async (request, reply) => {
        if (request.auth?.role !== "admin") {
          return reply
            .status(403)
            .send({ error: { code: "authorization.forbidden" } });
        }
      });
      admin.get("/admin/security/config", async (request, reply) => {
        const auth = actor(request, reply);
        if (!auth) {
          return reply;
        }
        const result = await iam.administration.getConfiguration.execute(
          auth.userId,
        );
        if (!result.success) {
          return applicationResponse(
            reply,
            result,
            GetSecurityConfigurationHttpErrors,
          );
        }
        return reply.send({
          data: {
            catalog: SECURITY_CONFIG_CATALOG,
            effective: result.value.effective,
            effectiveRevision: result.value.effectiveRevision,
            revisions: result.value.revisions.map((revision) => ({
              id: revision.id,
              version: revision.version,
              status: revision.status,
              justification: revision.justification,
              origin: revision.origin,
              restored_from_revision_id: revision.restoredFromRevisionId,
              created_by: revision.createdBy,
              created_at: revision.createdAt,
              published_at: revision.publishedAt,
              changes: revision.changes,
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
        password: Type.Optional(Type.String({ maxLength: 1024 })),
        mfaCode: Type.Optional(Type.String()),
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
            await iam.administration.publishConfiguration.execute({
              actorId: auth.userId,
              values: request.body.values,
              expectedVersion: request.body.expectedVersion,
              justification: request.body.justification,
              confirmedCritical: request.body.confirmedCritical === true,
              sessionId: auth.sessionId,
              ...(request.body.password !== undefined
                ? { password: request.body.password }
                : {}),
              ...(request.body.mfaCode !== undefined
                ? { mfaCode: request.body.mfaCode }
                : {}),
            }),
            PublishSecurityConfigurationHttpErrors,
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
          const result = await iam.administration.previewConfiguration.execute({
            actorId: auth.userId,
            values: request.body.values,
          });
          return applicationResponse(
            reply,
            result,
            PreviewSecurityConfigurationHttpErrors,
          );
        },
      );
      const revision = Type.Object({ revisionId: Type.String() });
      admin.post<{
        Params: Static<typeof revision>;
        Body: Omit<Static<typeof publication>, "values">;
      }>(
        "/admin/security/config/:revisionId/rollback",
        {
          schema: {
            params: revision,
            body: Type.Omit(publication, ["values"]),
          },
        },
        async (request, reply) => {
          const auth = actor(request, reply);
          if (!auth) {
            return reply;
          }
          return applicationResponse(
            reply,
            await iam.administration.restoreConfiguration.execute({
              actorId: auth.userId,
              revisionId: request.params.revisionId,
              expectedVersion: request.body.expectedVersion,
              justification: request.body.justification,
              confirmedCritical: request.body.confirmedCritical === true,
              sessionId: auth.sessionId,
              ...(request.body.password !== undefined
                ? { password: request.body.password }
                : {}),
              ...(request.body.mfaCode !== undefined
                ? { mfaCode: request.body.mfaCode }
                : {}),
            }),
            RestoreSecurityConfigurationHttpErrors,
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
        const result = await iam.accounts.maintainAccounts.execute();
        if (!result.success) {
          return applicationResponse(reply, result, {});
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
