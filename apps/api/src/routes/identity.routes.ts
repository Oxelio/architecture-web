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
  };
}
