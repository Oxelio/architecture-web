// @file apps/api/src/controllers/identity/get-user-profile.controller.ts

import type { FastifyReply } from "fastify";
import type {
  GetUserProfileInput,
  GetUserProfileUseCase,
} from "@architecture/identity/application";
import { GetUserProfilePresenter } from "#presentation/get-user-profile.presenter";
import {
  sendControllerResponse,
  type AuthenticatedRequest,
} from "./controller-response.js";

type GetUserProfileHTTPRequest = AuthenticatedRequest;

export function buildGetUserProfileController(useCase: GetUserProfileUseCase) {
  return {
    handle: async (request: GetUserProfileHTTPRequest, reply: FastifyReply) => {
      const auth = request.auth;

      if (!auth) {
        return reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      const command: GetUserProfileInput = {
        userId: auth.userId,
      };

      const result = await useCase.execute(command);

      const response = GetUserProfilePresenter.toPresentation(result);

      return sendControllerResponse(reply, response);
    },
  };
}
