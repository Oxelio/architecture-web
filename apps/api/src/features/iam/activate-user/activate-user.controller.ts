// @file apps/api/src/features/iam/activate-user/activate-user.controller.ts

import type {
  ActivateUser,
  ActivateUserInput,
} from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { ActivateUserPresenter } from "./activate-user.presenter.js";
import type { ActivateRoute } from "./activate-user.route-options.js";

type ActivateUserHTTPRequest = FastifyRequest<ActivateRoute>;

export function createActivateUserController(useCase: ActivateUser) {
  return async (request: ActivateUserHTTPRequest, reply: FastifyReply) => {
    const command: ActivateUserInput = {
      actorUserId: request.auth?.userId ?? "",
      userId: request.params.userId,
    };

    const result = await useCase.execute(command);

    const response = ActivateUserPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
