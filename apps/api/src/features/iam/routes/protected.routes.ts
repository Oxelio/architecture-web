import type { FastifyInstance } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";
import {
  type ChangeEmailRoute,
  changeEmailRouteOptions,
} from "#iam/change-email/change-email.route-options";
import {
  type ChangePasswordRoute,
  changePasswordRouteOptions,
} from "#iam/change-password/change-password.route-options";
import type { IamControllers } from "#iam/compose-controllers";
import { getCurrentAccountRouteOptions } from "#iam/get-current-account/get-current-account.route-options";
import { listCurrentUserSessionsRouteOptions } from "#iam/list-user-sessions/list-current-user-sessions.route-options";
import { resendEmailVerificationRouteOptions } from "#iam/resend-email-verification/resend-email-verification.route-options";
import {
  type RevokeCurrentUserSessionRoute,
  revokeCurrentUserSessionRouteOptions,
} from "#iam/revoke-user-session/revoke-current-user-session.route-options";

export function registerProtectedRoutes(controllers: IamControllers) {
  return (app: FastifyInstance) => {
    try {
      const { authenticate } = app as AuthenticatedFastifyInstance;

      app.addHook("preHandler", authenticate);

      app.post(
        "/verify/resend",
        resendEmailVerificationRouteOptions,
        controllers.resendEmailVerification,
      );

      app.get(
        "/me",
        getCurrentAccountRouteOptions,
        controllers.getCurrentAccount,
      );

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

      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  };
}
