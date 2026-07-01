// src/server.ts

import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import pkg from "../package.json" with { type: "json" };
import { errorHandler } from "./http/error-handler.js";
import {
  buildIdentityRoutes,
  buildProfileRoutes,
} from "@architecture/identity/presentation/http";
import { buildApplicationContainer } from "./composition-root/application.container.js";
import {
  authPlugin,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./auth.js";

const apiVersion = `v${pkg.version.split(".")[0]}`;

export async function buildServer() {
  const app = Fastify({ logger: true });

  // global error handler
  app.setErrorHandler(errorHandler);

  await app.register(fastifyCors, {
    credentials: true,
    origin: process.env["WEB_ORIGIN"] ?? "http://localhost:5173",
  });

  // =========================
  // Composition Root (DI)
  // =========================
  const container = buildApplicationContainer();
  const sessionCookieOptions = buildSessionCookieOptions();

  await app.register(authPlugin, {
    validateSession: container.identity.validateSession,
    sessionCookieName: SESSION_COOKIE_NAME,
  });

  // =========================
  // Routes registration
  // =========================
  app.register(
    buildIdentityRoutes(container.identity, {
      name: SESSION_COOKIE_NAME,
      options: sessionCookieOptions,
    }),
    {
      prefix: `/${apiVersion}/auth`,
    },
  );

  app.register(buildProfileRoutes(container.profile), {
    prefix: `/${apiVersion}`,
  });

  return app;
}
