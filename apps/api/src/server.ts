// src/server.ts

import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import pkg from "../package.json" with { type: "json" };
import { errorHandler } from "./http/error-handler.js";
import { buildApplicationContainer } from "./composition-root/application.container.js";
import {
  authPlugin,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./auth.js";
import { buildIdentityRoutes } from "./routes/identity.routes.js";

const apiVersion = `v${pkg.version.split(".")[0]}`;

export async function buildServer() {
  const app = Fastify({ logger: true });

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
        version: "1.0.0",
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
  const container = buildApplicationContainer();
  const sessionCookieOptions = buildSessionCookieOptions();

  await app.register(authPlugin, {
    resolveSession: container.identity.resolveSession,
    sessionCookieName: SESSION_COOKIE_NAME,
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
