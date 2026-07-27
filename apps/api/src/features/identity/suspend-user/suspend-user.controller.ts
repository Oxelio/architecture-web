// @file apps/api/src/features/identity/suspend-user/suspend-user.controller.ts

import type {
  SuspendUser,
  SuspendUserInput,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import type { AuthenticatedRequest } from "#types/controller-response";

import { SuspendUserPresenter } from "./suspend-user.presenter.js";
import type { SuspendUserRoute } from "./suspend-user.route-options.js";

type SuspendUserHTTPRequest = AuthenticatedRequest<SuspendUserRoute>;

export function createSuspendUserController(useCase: SuspendUser) {
  return async (request: SuspendUserHTTPRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED" } });
    }

    const command: SuspendUserInput = {
      userId: request.params.userId,
      actorUserId: request.auth.userId,
    };

    const result = await useCase.execute(command);

    const response = SuspendUserPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
