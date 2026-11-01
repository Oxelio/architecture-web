import type { SecurityEventRecorder } from "@architecture/iam/application";
import type { FastifyInstance } from "fastify";

export function registerHttpAudit(
  app: FastifyInstance,
  events: SecurityEventRecorder,
): void {
  app.addHook("onResponse", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const type = auditTypeFor(request.method, path);
    if (!type) {
      return;
    }
    if (reply.statusCode < 400 && DOMAIN_AUDITED_HTTP_EVENTS.has(type)) {
      return;
    }
    try {
      await events.record(
        type,
        reply.statusCode >= 500
          ? "technical_failure"
          : reply.statusCode < 400
            ? "success"
            : "denied",
        {
          actorType: auditActorType(request.auth),
          ...(request.auth ? { actorId: request.auth.userId } : {}),
          ...(request.auth ? { subjectId: request.auth.userId } : {}),
          correlationId: String(request.id),
          ipAddress: request.ip,
          ...(request.headers["user-agent"]
            ? { client: request.headers["user-agent"] }
            : {}),
        },
        {
          method: request.method,
          route: request.routeOptions.url ?? "[unmatched]",
          statusCode: reply.statusCode,
        },
      );
    } catch (error) {
      request.log.error({ err: error }, "Security audit write failed");
    }
  });
}

function auditActorType(
  auth: { role: string } | null | undefined,
): "administrator" | "user" | "anonymous" {
  if (auth?.role === "admin") {
    return "administrator";
  }
  return auth ? "user" : "anonymous";
}

function auditTypeFor(method: string, path: string): string | null {
  const rules: readonly [RegExp, string][] = [
    [/\/iam\/signin$/, "authentication.signin"],
    [/\/iam\/signout$/, "authentication.signout"],
    [/\/iam\/signup$/, "account.created"],
    [/\/iam\/verify(?:\/resend)?$/, "account.email_verification"],
    [/\/iam\/me\/password$/, "account.password.changed"],
    [/\/iam\/me\/email$/, "account.email.changed"],
    [
      /\/iam\/.*sessions/,
      method === "DELETE" ? "session.revoked" : "session.consulted",
    ],
    [/\/iam\/users\/[^/]+\/role$/, "account.role.changed"],
    [/\/iam\/users\/[^/]+\/(?:activate|suspend)$/, "account.status.changed"],
  ];
  return rules.find(([pattern]) => pattern.test(path))?.[1] ?? null;
}

const DOMAIN_AUDITED_HTTP_EVENTS = new Set([
  "account.created",
  "account.email_verification",
  "account.password.changed",
  "account.email.changed",
  "account.role.changed",
  "account.status.changed",
]);
