import type { FastifyInstance } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";
import {
  type ChangeEmailRoute,
  changeEmailRouteOptions,
} from "#identity/change-email/change-email.route-options";
import {
  type ChangePasswordRoute,
  changePasswordRouteOptions,
} from "#identity/change-password/change-password.route-options";
import type { IdentityControllers } from "#identity/compose-controllers";
import { getUserProfileRouteOptions } from "#identity/get-user-profile/get-user-profile.route-options";
import { listCurrentUserSessionsRouteOptions } from "#identity/list-user-sessions/list-current-user-sessions.route-options";
import { resendEmailVerificationRouteOptions } from "#identity/resend-email-verification/resend-email-verification.route-options";
import {
  type RevokeCurrentUserSessionRoute,
  revokeCurrentUserSessionRouteOptions,
} from "#identity/revoke-user-session/revoke-current-user-session.route-options";

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
