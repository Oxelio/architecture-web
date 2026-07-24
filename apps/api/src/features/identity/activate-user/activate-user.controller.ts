// @file apps/api/src/features/identity/activate-user/activate-user.controller.ts

import type {
  ActivateUserInput,
  ActivateUser,
} from "@architecture/identity/application";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "../../../helpers/send-response.js";
import { ActivateUserPresenter } from "./activate-user.presenter.js";
import type { ActivateUserParamsSchema } from "./activate-user.route-options.js";

export type ActivateUserParams = Static<typeof ActivateUserParamsSchema>;

type ActivateUserHTTPRequest = FastifyRequest<{
  Params: ActivateUserParams;
}>;

export function createActivateUserController(useCase: ActivateUser) {
  return async (request: ActivateUserHTTPRequest, reply: FastifyReply) => {
    const command: ActivateUserInput = {
      userId: request.params.userId,
    };

    const result = await useCase.execute(command);

    const response = ActivateUserPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
