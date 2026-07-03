import type { FastifyInstance } from "fastify";
import { buildSignUpController } from "../controllers/sign-up.controller.js";
import {
  buildSignInController,
  type SessionCookieOptions,
} from "../controllers/sign-in.controller.js";
import { buildSignOutController } from "../controllers/sign-out.controller.js";
import { buildGetUserProfileController } from "../controllers/get-user-profile.controller.js";
import type { IdentityContainer } from "../composition-root/identity.container.js";
import type { AuthenticatedFastifyInstance } from "../auth.js";

export function buildIdentityRoutes(
  container: IdentityContainer,
  sessionCookie: SessionCookieOptions,
) {
  return async (app: FastifyInstance) => {
    const registerUserController = buildSignUpController(container.signUp);

    const authenticateUserController = buildSignInController(
      container.signIn,
      sessionCookie,
    );

    const logoutUserController = buildSignOutController(
      container.signOut,
      sessionCookie,
    );

    const authenticatedApp = app as AuthenticatedFastifyInstance;
    const getCurrentUserProfile = buildGetUserProfileController(
      container.getUserProfile,
    );

    app.post(
      "/register",
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
      registerUserController.handle,
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
      authenticateUserController.handle,
    );

    app.post("/signout", logoutUserController.handle);

    app.get(
      "/me",
      {
        preHandler: authenticatedApp.authenticate,
      },
      getCurrentUserProfile.handle,
    );
  };
}
