// @file apps/api/src/features/identity/identity.routes.ts

import type { IdentityApplication } from "@architecture/identity/application";
import type { FastifyInstance } from "fastify";

import { composeIdentityControllers } from "../compose-controllers.js";
import { type SessionCookieOptions } from "../sign-in/sign-in.controller.js";
import { registerAdminRoutes } from "./admin.routes.js";
import { registerProtectedRoutes } from "./protected.routes.js";
import { registerPublicRoutes } from "./public.routes.js";

export function buildIdentityRoutes(
  container: IdentityApplication,
  sessionCookie: SessionCookieOptions,
) {
  return async (app: FastifyInstance) => {
    const controllers = composeIdentityControllers(container, sessionCookie);

    app.register(registerPublicRoutes(controllers));
    app.register(registerProtectedRoutes(controllers));
    app.register(registerAdminRoutes(controllers));
  };
}
