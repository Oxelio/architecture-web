// @file apps/api/src/server.ts

// src/server.ts

import fastifyCors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import Fastify from "fastify";

import { registerHttpAudit } from "#helpers/register-http-audit";
import pkg from "#package" with { type: "json" };

import {
  authPlugin,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./auth.js";
import { buildApplicationModule } from "./composition-root/application.module.js";
import { buildIamRoutes } from "./features/iam/routes/index.js";
import { buildSecurityRoutes } from "./features/iam/security/security.routes.js";
import { buildNotificationRoutes } from "./notifications/notification.routes.js";
import { errorHandler } from "./types/error-handler.js";

const apiVersion = "v1";

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
  const container = await buildApplicationModule();

  app.addHook("onClose", async () => {
    await container.dispose();
  });

  try {
    const sessionCookieOptions = buildSessionCookieOptions();

    registerHttpAudit(app, container.securityEvents);

    await app.register(authPlugin, {
      resolveSession: container.iam.authentication.resolveSession,
      sessionCookieName: SESSION_COOKIE_NAME,
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
    await app.register(buildNotificationRoutes(container.notifications), {
      prefix: `/${apiVersion}/notifications`,
    });
    await app.register(
      buildSecurityRoutes(
        container.iam,
        {
          name: SESSION_COOKIE_NAME,
          options: sessionCookieOptions,
        },
        container.audit,
        container.configuration,
        container.securityEvents,
      ),
      { prefix: `/${apiVersion}/iam` },
    );

    await app.register(swaggerUI, {
      routePrefix: "/docs",
    });

    return app;
  } catch (error) {
    try {
      await app.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Server initialization and cleanup failed",
      );
    }
    throw error;
  }
}
