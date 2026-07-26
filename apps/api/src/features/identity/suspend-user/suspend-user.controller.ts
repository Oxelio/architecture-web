// @file apps/api/src/features/identity/suspend-user/suspend-user.controller.ts

import type {
  SuspendUser,
  SuspendUserInput,
} from "@architecture/identity/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { SuspendUserPresenter } from "./suspend-user.presenter.js";
import type { SuspendUserRoute } from "./suspend-user.route-options.js";

type SuspendUserHTTPRequest = FastifyRequest<SuspendUserRoute>;

export function createSuspendUserController(useCase: SuspendUser) {
  return async (request: SuspendUserHTTPRequest, reply: FastifyReply) => {
    const command: SuspendUserInput = {
      userId: request.params.userId,
    };

    const result = await useCase.execute(command);

    const response = SuspendUserPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
