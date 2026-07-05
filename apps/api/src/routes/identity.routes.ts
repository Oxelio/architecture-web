import type { FastifyInstance } from "fastify";
import { buildSignUpController } from "../controllers/sign-up.controller.js";
import {
  buildSignInController,
  type SessionCookieOptions,
} from "../controllers/sign-in.controller.js";
import { buildSignOutController } from "../controllers/sign-out.controller.js";
import { buildGetUserProfileController } from "../controllers/get-user-profile.controller.js";
import type { IdentityContainer } from "../composition-root/identity.container.js";
import { buildVerifyEmailController } from "../controllers/verify-email.controller.js";
import { buildChangeEmailController } from "../controllers/change-email.controller.js";
import { buildChangePasswordController } from "../controllers/change-password.controller.js";
import { buildActivateUserController } from "../controllers/activate-user.controller.js";
import { buildSuspendUserController } from "../controllers/suspend-user.controller.js";
import type { AuthenticatedFastifyInstance } from "../auth.js";

export function buildIdentityRoutes(
  container: IdentityContainer,
  sessionCookie: SessionCookieOptions,
) {
  return async (app: FastifyInstance) => {
    const signUpController = buildSignUpController(container.signUp);

    const signInController = buildSignInController(
      container.signIn,
      sessionCookie,
    );

    const signOutController = buildSignOutController(
      container.signOut,
      sessionCookie,
    );

    const authenticatedApp = app as AuthenticatedFastifyInstance;
    const getUserProfile = buildGetUserProfileController(
      container.getUserProfile,
    );
    const verifyEmailController = buildVerifyEmailController(
      container.verifyEmail,
    );
    const changeEmailController = buildChangeEmailController(
      container.changeEmail,
    );
    const changePasswordController = buildChangePasswordController(
      container.changePassword,
    );
    const activateUserController = buildActivateUserController(
      container.activateUser,
    );
    const suspendUserController = buildSuspendUserController(
      container.suspendUser,
    );

    app.post(
      "/signup",
      {
        schema: {
          body: {
            type: "object",
            required: ["email", "password"],
            properties: {
              email: { type: "string" },
              password: { type: "string", minLength: 8 },
            },
          },
        },
      },
      signUpController.handle,
    );

    app.post(
      "/signin",
      {
        schema: {
          body: {
            type: "object",
            required: ["email", "password"],
            properties: {
              email: { type: "string" },
              password: { type: "string" },
            },
          },
        },
      },
      signInController.handle,
    );

    app.post("/signout", signOutController.handle);

    app.get(
      "/me",
      {
        preHandler: authenticatedApp.authenticate,
      },
      getUserProfile.handle,
    );

    app.get(
      "/verify",
      {
        schema: {
          querystring: {
            type: "object",
            required: ["token"],
            properties: {
              token: { type: "string" },
            },
          },
        },
      },
      verifyEmailController.handle,
    );

    app.patch(
      "/me/email",
      {
        preHandler: authenticatedApp.authenticate,
        schema: {
          body: {
            type: "object",
            required: ["email"],
            properties: {
              email: { type: "string" },
            },
          },
        },
      },
      changeEmailController.handle,
    );

    app.patch(
      "/me/password",
      {
        preHandler: authenticatedApp.authenticate,
        schema: {
          body: {
            type: "object",
            required: ["password"],
            properties: {
              password: { type: "string", minLength: 8 },
            },
          },
        },
      },
      changePasswordController.handle,
    );

    app.patch("/users/:userId/activate", activateUserController.handle);

    app.patch("/users/:userId/suspend", suspendUserController.handle);
  };
}
