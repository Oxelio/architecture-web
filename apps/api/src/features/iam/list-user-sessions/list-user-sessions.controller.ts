import type { ListUserSessions } from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { ListUserSessionsPresenter } from "./list-user-sessions.presenter.js";
import type { ListUserSessionsRoute } from "./list-user-sessions.route-options.js";

export function createListUserSessionsController(useCase: ListUserSessions) {
  return async (
    request: FastifyRequest<ListUserSessionsRoute>,
    reply: FastifyReply,
  ) => {
    const result = await useCase.execute({
      actorUserId: request.auth?.userId ?? "",
      userId: request.params.userId,
      ...(request.auth?.sessionId
        ? { currentSessionId: request.auth.sessionId }
        : {}),
    });
    return sendControllerResponse(
      reply,
      ListUserSessionsPresenter.toPresentation(result),
    );
  };
}
