import type { FastifyInstance } from "fastify";
import { buildRegisterUserController } from "../controllers/register-user.controller.js";
import { RegisterUserUseCase } from "#application/use-cases/register-user/register-user.use-case";
import { AuthenticateUserUseCase } from "#application/use-cases/authenticate-user/authenticate-user.use-case";
import { buildAuthenticateUserController } from "../controllers/authenticate-user.controller.js";

interface IdentityContainer {
  readonly registerUser: RegisterUserUseCase;
  readonly authenticateUser: AuthenticateUserUseCase;
}

export function buildIdentityRoutes(container: IdentityContainer) {
  return async (app: FastifyInstance) => {
    const registerUserController = buildRegisterUserController(
      container.registerUser,
    );

    const authenticateUserController = buildAuthenticateUserController(
      container.authenticateUser,
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
  };
}
