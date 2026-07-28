// @file apps/api/src/features/iam/iam.routes.ts

import type { IamApplication } from "@architecture/iam/application";
import type { FastifyInstance } from "fastify";

import { composeIamControllers } from "#iam/compose-controllers";
import { type SessionCookieOptions } from "#iam/sign-in/sign-in.controller";

import { registerAdminRoutes } from "./admin.routes.js";
import { registerProtectedRoutes } from "./protected.routes.js";
import { registerPublicRoutes } from "./public.routes.js";

export function buildIamRoutes(
  container: IamApplication,
  sessionCookie: SessionCookieOptions,
) {
  return async (app: FastifyInstance) => {
    const controllers = composeIamControllers(container, sessionCookie);

    app.register(registerPublicRoutes(controllers));
    app.register(registerProtectedRoutes(controllers));
    app.register(registerAdminRoutes(controllers));
  };
}
