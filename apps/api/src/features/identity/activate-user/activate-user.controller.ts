// @file apps/api/src/features/identity/activate-user/activate-user.controller.ts

import type {
  ActivateUserCommand,
  ActivateUserUseCase,
} from "@architecture/identity/application";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { ActivateUserParamsSchema } from "./activate-user.route-options.js";
import { ActivateUserPresenter } from "./activate-user.presenter.js";
import { sendControllerResponse } from "../../../helpers/send-response.js";

export type ActivateUserParams = Static<typeof ActivateUserParamsSchema>;

type ActivateUserHTTPRequest = FastifyRequest<{
  Params: ActivateUserParams;
}>;

export function createActivateUserController(useCase: ActivateUserUseCase) {
  return async (request: ActivateUserHTTPRequest, reply: FastifyReply) => {
    const command: ActivateUserCommand = {
      userId: request.params.userId,
    };

    const result = await useCase.execute(command);

    const response = ActivateUserPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
