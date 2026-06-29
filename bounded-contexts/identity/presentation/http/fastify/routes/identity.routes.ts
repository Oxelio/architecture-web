import type { FastifyInstance } from "fastify";
import { buildRegisterUserController } from "../controllers/register-user.controller.js";
import { RegisterUserUseCase } from "#application/use-cases/register-user/register-user.use-case";

interface IdentityContainer {
  readonly registerUser: RegisterUserUseCase;
}

export function buildIdentityRoutes(container: IdentityContainer) {
  return async (app: FastifyInstance) => {
    const registerUserController = buildRegisterUserController(
      container.registerUser,
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
  };
}
