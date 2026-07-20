// @file apps/api/src/features/identity/suspend-user/suspend-user.controller.ts

import type {
  SuspendUserInput,
  SuspendUserUseCase,
} from "@architecture/identity/application";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "../../../helpers/send-response.js";
import { SuspendUserPresenter } from "./suspend-user.presenter.js";
import type { SuspendUserParamsSchema } from "./suspend-user.route-options.js";

export type SuspendUserParams = Static<typeof SuspendUserParamsSchema>;

type SuspendUserHTTPRequest = FastifyRequest<{
  Params: SuspendUserParams;
}>;

export function createSuspendUserController(useCase: SuspendUserUseCase) {
  return async (request: SuspendUserHTTPRequest, reply: FastifyReply) => {
    const command: SuspendUserInput = {
      userId: request.params.userId,
    };

    const result = await useCase.execute(command);

    const response = SuspendUserPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
