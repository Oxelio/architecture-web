// @file apps/api/src/features/identity/identity.routes.ts

import type { IdentityApplication } from "@architecture/identity/application";
import type { FastifyInstance } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";

import { createActivateUserController } from "./activate-user/activate-user.controller.js";
import { activateUserRouteOptions } from "./activate-user/activate-user.route-options.js";
import { createAssignUserRoleController } from "./assign-user-role/assign-user-role.controller.js";
import {
  type AssignUserRoleRoute,
  assignUserRoleRouteOptions,
} from "./assign-user-role/assign-user-role.route-options.js";
import { createChangeEmailController } from "./change-email/change-email.controller.js";
import {
  type ChangeEmailRoute,
  changeEmailRouteOptions,
} from "./change-email/change-email.route-options.js";
import { createChangePasswordController } from "./change-password/change-password.controller.js";
import {
  type ChangePasswordRoute,
  changePasswordRouteOptions,
} from "./change-password/change-password.route-options.js";
import { createGetUserProfileController } from "./get-user-profile/get-user-profile.controller.js";
import { getUserProfileRouteOptions } from "./get-user-profile/get-user-profile.route-options.js";
import { createResendEmailVerificationController } from "./resend-email-verification/resend-email-verification.controller.js";
import { resendEmailVerificationRouteOptions } from "./resend-email-verification/resend-email-verification.route-options.js";
import {
  createSignInController,
  type SessionCookieOptions,
} from "./sign-in/sign-in.controller.js";
import { signInRouteOptions } from "./sign-in/sign-in.route-options.js";
import { createSignOutController } from "./sign-out/sign-out.controller.js";
import { signOutRouteOptions } from "./sign-out/sign-out.route-options.js";
import { createSignUpController } from "./sign-up/sign-up.controller.js";
import { signUpRouteOptions } from "./sign-up/sign-up.route-options.js";
import { createSuspendUserController } from "./suspend-user/suspend-user.controller.js";
import { suspendUserRouteOptions } from "./suspend-user/suspend-user.route-options.js";
import { createVerifyEmailController } from "./verify-email/verify-email.controller.js";
import { verifyEmailRouteOptions } from "./verify-email/verify-email.route-options.js";

export function buildIdentityRoutes(
  container: IdentityApplication,
  sessionCookie: SessionCookieOptions,
) {
  return async (app: FastifyInstance) => {
    const { authenticate } = app as AuthenticatedFastifyInstance;

    const controllers = composeIdentityControllers(container, sessionCookie);

    // Public
    app.get("/verify", verifyEmailRouteOptions, controllers.verifyEmail);

    app.post("/signup", signUpRouteOptions, controllers.signUp);
    app.post("/signin", signInRouteOptions, controllers.signIn);
    app.post("/signout", signOutRouteOptions, controllers.signOut);

    app.register(async (adminApp) => {
      adminApp.addHook("preHandler", authenticate);
      adminApp.addHook("preHandler", async (request, reply) => {
        if (request.auth?.role !== "admin") {
          return reply.status(403).send({ error: { code: "FORBIDDEN" } });
        }
      });

      adminApp.patch(
        "/users/:userId/activate",
        activateUserRouteOptions,
        controllers.activateUser,
      );

      adminApp.patch(
        "/users/:userId/suspend",
        suspendUserRouteOptions,
        controllers.suspendUser,
      );

      adminApp.patch<AssignUserRoleRoute>(
        "/users/:userId/role",
        assignUserRoleRouteOptions,
        controllers.assignUserRole,
      );
    });

    // Protected
    app.register(async (protectedApp) => {
      protectedApp.addHook("preHandler", authenticate);

      protectedApp.post(
        "/verify/resend",
        resendEmailVerificationRouteOptions,
        controllers.resendEmailVerification,
      );

      protectedApp.get(
        "/me",
        getUserProfileRouteOptions,
        controllers.getUserProfile,
      );

      protectedApp.patch<ChangeEmailRoute>(
        "/me/email",
        changeEmailRouteOptions,
        controllers.changeEmail,
      );

      protectedApp.patch<ChangePasswordRoute>(
        "/me/password",
        changePasswordRouteOptions,
        controllers.changePassword,
      );
    });
  };
}

function composeIdentityControllers(
  container: IdentityApplication,
  sessionCookie: SessionCookieOptions,
) {
  return {
    signUp: createSignUpController(container.signUp),
    signIn: createSignInController(container.signIn, sessionCookie),
    signOut: createSignOutController(container.signOut, sessionCookie),
    getUserProfile: createGetUserProfileController(container.getUserProfile),
    verifyEmail: createVerifyEmailController(container.verifyEmail),
    resendEmailVerification: createResendEmailVerificationController(
      container.resendEmailVerification,
    ),
    changeEmail: createChangeEmailController(container.changeEmail),
    changePassword: createChangePasswordController(container.changePassword),
    activateUser: createActivateUserController(container.activateUser),
    suspendUser: createSuspendUserController(container.suspendUser),
    assignUserRole: createAssignUserRoleController(container.assignUserRole),
  };
}
