// @file apps/api/src/server.ts

// src/server.ts

import fastifyCors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import Fastify from "fastify";

import pkg from "#package" with { type: "json" };

import {
  authPlugin,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./auth.js";
import { buildApplicationModule } from "./composition-root/application.module.js";
import { buildIamRoutes } from "./features/iam/routes/index.js";
import { buildSecurityRoutes } from "./security/security.routes.js";
import { errorHandler } from "./types/error-handler.js";

const apiVersion = `v${pkg.version.split(".")[0]}`;

export async function buildServer() {
  const app = Fastify({
    logger: true,
    trustProxy: process.env["TRUST_PROXY"] === "true",
  });

  // global error handler
  app.setErrorHandler(errorHandler);

  await app.register(fastifyCors, {
    credentials: true,
    origin: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // =========================
  // Documentation
  // =========================
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Architecture API",
        description: "API documentation",
        version: pkg.version,
      },
      servers: [
        {
          url: "http://localhost:3000",
        },
      ],
    },
  });

  // =========================
  // Composition Root (DI)
  // =========================
  const container = buildApplicationModule();
  const sessionCookieOptions = buildSessionCookieOptions();

  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const policy = await container.security.policy();
    const disabled =
      (request.method === "POST" &&
        path.endsWith("/iam/signup") &&
        !policy.accounts.publicRegistration) ||
      (request.method === "PATCH" &&
        path.endsWith("/iam/me/email") &&
        !policy.accounts.emailChange) ||
      (path.includes("/sessions") && !policy.sessions.userManagement);
    if (disabled) {
      return reply.status(403).send({ error: { code: "FEATURE_DISABLED" } });
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const type = auditTypeFor(request.method, path);
    if (!type) {
      return;
    }
    try {
      await container.security.audit(
        type,
        reply.statusCode < 400 ? "success" : "denied",
        {
          actorType:
            request.auth?.role === "admin"
              ? "administrator"
              : request.auth
                ? "user"
                : "anonymous",
          ...(request.auth ? { actorId: request.auth.userId } : {}),
          ...(request.auth ? { subjectId: request.auth.userId } : {}),
          correlationId: String(request.id),
          ipAddress: request.ip,
          ...(request.headers["user-agent"]
            ? { client: request.headers["user-agent"] }
            : {}),
        },
        { method: request.method, route: path, statusCode: reply.statusCode },
      );
    } catch (error) {
      request.log.error({ err: error }, "Security audit write failed");
    }
  });

  await app.register(authPlugin, {
    resolveSession: container.iam.resolveSession,
    sessionCookieName: SESSION_COOKIE_NAME,
  });

  app.addHook("onClose", async () => {
    await container.dispose();
  });

  // =========================
  // Routes registration
  // =========================
  await app.register(
    buildIamRoutes(container.iam, {
      name: SESSION_COOKIE_NAME,
      options: sessionCookieOptions,
    }),
    {
      prefix: `/${apiVersion}/iam`,
    },
  );
  await app.register(
    buildSecurityRoutes(container.security, {
      name: SESSION_COOKIE_NAME,
      options: sessionCookieOptions,
    }),
    { prefix: `/${apiVersion}/iam` },
  );

  await app.register(swaggerUI, {
    routePrefix: "/docs",
  });

  return app;
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
