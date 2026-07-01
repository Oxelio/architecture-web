import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { GetMyProfileUseCase } from "@architecture/identity/application";
import { buildGetMyProfileController } from "../controllers/get-my-profile.controller.js";

interface ProfileContainer {
  readonly getMyProfile: GetMyProfileUseCase;
}

interface AuthenticatedFastifyInstance extends FastifyInstance {
  authenticate: preHandlerHookHandler;
}

export function buildProfileRoutes(container: ProfileContainer) {
  return async (app: FastifyInstance) => {
    const authenticatedApp = app as AuthenticatedFastifyInstance;
    const getMyProfileController = buildGetMyProfileController(
      container.getMyProfile,
    );

    app.get(
      "/me",
      {
        preHandler: authenticatedApp.authenticate,
      },
      getMyProfileController.handle,
    );
  };
}
