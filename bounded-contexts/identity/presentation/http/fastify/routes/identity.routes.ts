import type { FastifyInstance } from "fastify";
import { buildRegisterUserController } from "../controllers/register-user.controller.js";
import { RegisterUserUseCase } from "#application/use-cases/register-user/register-user.use-case";
import { AuthenticateUserUseCase } from "#application/use-cases/authenticate-user/authenticate-user.use-case";
import {
  buildAuthenticateUserController,
  type SessionCookieOptions,
} from "../controllers/authenticate-user.controller.js";
import { LogoutUserUseCase } from "#application/use-cases/logout-user/logout-user.use-case";
import { buildLogoutUserController } from "../controllers/logout-user.controller.js";

interface IdentityContainer {
  readonly registerUser: RegisterUserUseCase;
  readonly authenticateUser: AuthenticateUserUseCase;
  readonly logoutUser: LogoutUserUseCase;
}

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
  };
}
