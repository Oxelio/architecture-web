import type { FastifyInstance } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";

import {
  type ChangeEmailRoute,
  changeEmailRouteOptions,
} from "../change-email/change-email.route-options.js";
import {
  type ChangePasswordRoute,
  changePasswordRouteOptions,
} from "../change-password/change-password.route-options.js";
import type { IdentityControllers } from "../compose-controllers.js";
import { getUserProfileRouteOptions } from "../get-user-profile/get-user-profile.route-options.js";
import { listCurrentUserSessionsRouteOptions } from "../list-user-sessions/list-current-user-sessions.route-options.js";
import { resendEmailVerificationRouteOptions } from "../resend-email-verification/resend-email-verification.route-options.js";
import {
  type RevokeCurrentUserSessionRoute,
  revokeCurrentUserSessionRouteOptions,
} from "../revoke-user-session/revoke-current-user-session.route-options.js";

export function registerProtectedRoutes(controllers: IdentityControllers) {
  return async (app: FastifyInstance) => {
    const { authenticate } = app as AuthenticatedFastifyInstance;

    app.addHook("preHandler", authenticate);

    app.post(
      "/verify/resend",
      resendEmailVerificationRouteOptions,
      controllers.resendEmailVerification,
    );

    app.get("/me", getUserProfileRouteOptions, controllers.getUserProfile);

    app.get(
      "/me/sessions",
      listCurrentUserSessionsRouteOptions,
      controllers.listCurrentUserSessions,
    );

    app.delete<RevokeCurrentUserSessionRoute>(
      "/me/sessions/:sessionId",
      revokeCurrentUserSessionRouteOptions,
      controllers.revokeCurrentUserSession,
    );

    app.patch<ChangeEmailRoute>(
      "/me/email",
      changeEmailRouteOptions,
      controllers.changeEmail,
    );

    app.patch<ChangePasswordRoute>(
      "/me/password",
      changePasswordRouteOptions,
      controllers.changePassword,
    );
  };
}
