import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { GetCurrentUserProfileUseCase } from "@architecture/identity/application";
import { buildGetCurrentUserProfileController } from "../controllers/get-current-user-profile.controller.js";

interface ProfileContainer {
  readonly getMyProfile: GetCurrentUserProfileUseCase;
}

interface AuthenticatedFastifyInstance extends FastifyInstance {
  authenticate: preHandlerHookHandler;
}

export function buildProfileRoutes(container: ProfileContainer) {
  return async (app: FastifyInstance) => {
    const authenticatedApp = app as AuthenticatedFastifyInstance;
    const getMyProfileController = buildGetCurrentUserProfileController(
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
