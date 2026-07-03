import type { FastifyInstance } from "fastify";
import { buildRegisterUserController } from "../controllers/register-user.controller.js";
import {
  buildAuthenticateUserController,
  type SessionCookieOptions,
} from "../controllers/authenticate-user.controller.js";
import { buildLogoutUserController } from "../controllers/logout-user.controller.js";
import { buildGetCurrentUserProfileController } from "../controllers/get-current-user-profile.controller.js";
import type { IdentityContainer } from "../composition-root/identity.container.js";
import type { AuthenticatedFastifyInstance } from "../auth.js";

export function buildIdentityRoutes(
  container: IdentityContainer,
  sessionCookie: SessionCookieOptions,
) {
  return async (app: FastifyInstance) => {
    const registerUserController = buildRegisterUserController(
      container.registerUser,
    );

    const authenticateUserController = buildAuthenticateUserController(
      container.authenticateUser,
      sessionCookie,
    );

    const logoutUserController = buildLogoutUserController(
      container.logoutUser,
      sessionCookie,
    );

    const authenticatedApp = app as AuthenticatedFastifyInstance;
    const getCurrentUserProfile = buildGetCurrentUserProfileController(
      container.getCurrentUserProfile,
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
      "/login",
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

    app.post("/logout", logoutUserController.handle);

    app.get(
      "/me",
      {
        preHandler: authenticatedApp.authenticate,
      },
      getCurrentUserProfile.handle,
    );
  };
}
