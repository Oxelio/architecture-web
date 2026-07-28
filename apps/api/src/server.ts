// @file apps/api/src/server.ts

// src/server.ts

import fastifyCors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import Fastify from "fastify";

import pkg from "../package.json" with { type: "json" };
import {
  authPlugin,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./auth.js";
import { buildApplicationModule } from "./composition-root/application.module.js";
import { buildIdentityRoutes } from "./features/identity/routes/index.js";
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

  await app.register(authPlugin, {
    resolveSession: container.identity.resolveSession,
    sessionCookieName: SESSION_COOKIE_NAME,
  });

  app.addHook("onClose", async () => {
    await container.dispose();
  });

  // =========================
  // Routes registration
  // =========================
  await app.register(
    buildIdentityRoutes(container.identity, {
      name: SESSION_COOKIE_NAME,
      options: sessionCookieOptions,
    }),
    {
      prefix: `/${apiVersion}/identity`,
    },
  );

  await app.register(swaggerUI, {
    routePrefix: "/docs",
  });

  return app;
}
