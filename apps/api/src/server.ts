// src/server.ts

import Fastify from "fastify";
import pkg from "../package.json" with { type: "json" };
import { errorHandler } from "./http/error-handler.js";
import { buildIdentityRoutes } from "@architecture/identity/presentation/http";
import { buildApplicationContainer } from "./composition-root/application.container.js";

const apiVersion = `v${pkg.version.split(".")[0]}`;

export async function buildServer() {
  const app = Fastify({ logger: true });

  // global error handler
  app.setErrorHandler(errorHandler);

  // =========================
  // Composition Root (DI)
  // =========================
  const container = buildApplicationContainer();

  // =========================
  // Routes registration
  // =========================
  app.register(buildIdentityRoutes(container.identity), {
    prefix: `/${apiVersion}/auth`,
  });

  return app;
}
