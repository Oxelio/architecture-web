import type { FastifyInstance } from "fastify";
import { buildRegisterUserController } from "../controllers/register-user.controller.js";

export function buildIdentityRoutes(container: any) {
  return async (app: FastifyInstance) => {
    const registerUserController = buildRegisterUserController(
      container.registerUser,
    );

    app.post("/register", registerUserController.handle);
  };
}
