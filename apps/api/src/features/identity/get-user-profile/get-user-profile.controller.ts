// @file apps/api/src/features/identity/get-user-profile/get-user-profile.controller.ts

import type {
  GetUserProfile,
  GetUserProfileInput,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import { type AuthenticatedRequest } from "#types/controller-response";

import { GetUserProfilePresenter } from "./get-user-profile.presenter.js";

type GetUserProfileHTTPRequest = AuthenticatedRequest;

export function createGetUserProfileController(useCase: GetUserProfile) {
  return async (request: GetUserProfileHTTPRequest, reply: FastifyReply) => {
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
  };
}
