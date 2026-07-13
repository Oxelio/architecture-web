// @file apps/api/src/routes/identity.routes.ts

import type { FastifyInstance } from "fastify";

import type { IdentityContainer } from "#composition-root/identity.container";
import { buildIdentityControllers } from "#controllers/identity/controllers.factory";
import { type SessionCookieOptions } from "#controllers/identity/sign-in.controller";
import { activateUserSchema } from "#schema/identity/activate-user.schema";
import { changeEmailSchema } from "#schema/identity/change-email.schema";
import { changePasswordSchema } from "#schema/identity/change-password.schema";
import { getUserProfileSchema } from "#schema/identity/get-user-profile.schema";
import { resendEmailVerificationSchema } from "#schema/identity/resend-email-verification.schema";
import { signInSchema } from "#schema/identity/sign-in.schema";
import { signOutSchema } from "#schema/identity/sign-out.schema";
import { signUpSchema } from "#schema/identity/sign-up.schema";
import { suspendUserSchema } from "#schema/identity/suspend-user.schema";
import { verifyEmailSchema } from "#schema/identity/verify-email.schema";

import type { AuthenticatedFastifyInstance } from "../auth.js";

export function buildIdentityRoutes(
  container: IdentityContainer,
  sessionCookie: SessionCookieOptions,
) {
  return async (app: FastifyInstance) => {
    const controllers = buildIdentityControllers(container, sessionCookie);
    const authenticatedApp = app as AuthenticatedFastifyInstance;

    app.post("/signup", { schema: signUpSchema }, controllers.signUp.handle);
    app.post("/signin", { schema: signInSchema }, controllers.signIn.handle);
    app.post("/signout", { schema: signOutSchema }, controllers.signOut.handle);
    app.post(
      "/verify/resend",
      {
        preHandler: authenticatedApp.authenticate,
        schema: resendEmailVerificationSchema,
      },
      controllers.resendEmailVerification.handle,
    );

    app.get(
      "/me",
      {
        preHandler: authenticatedApp.authenticate,
        schema: getUserProfileSchema,
      },
      controllers.getUserProfile.handle,
    );

    app.get(
      "/verify",
      { schema: verifyEmailSchema },
      controllers.verifyEmail.handle,
    );

    app.patch(
      "/me/email",
      {
        preHandler: authenticatedApp.authenticate,
        schema: changeEmailSchema,
      },
      controllers.changeEmail.handle,
    );

    app.patch(
      "/me/password",
      {
        preHandler: authenticatedApp.authenticate,
        schema: changePasswordSchema,
      },
      controllers.changePassword.handle,
    );

    app.patch(
      "/users/:userId/activate",
      {
        schema: activateUserSchema,
      },
      controllers.activateUser.handle,
    );
    app.patch(
      "/users/:userId/suspend",
      {
        schema: suspendUserSchema,
      },
      controllers.suspendUser.handle,
    );
  };
}
