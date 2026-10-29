import type { RevokeUserSession } from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { RevokeUserSessionPresenter } from "./revoke-user-session.presenter.js";
import type { RevokeUserSessionRoute } from "./revoke-user-session.route-options.js";

export function createRevokeUserSessionController(useCase: RevokeUserSession) {
  return async (
    request: FastifyRequest<RevokeUserSessionRoute>,
    reply: FastifyReply,
  ) => {
    const result = await useCase.execute({
      actorUserId: request.auth?.userId ?? "",
      userId: request.params.userId,
      ...(request.params.sessionId
        ? { sessionId: request.params.sessionId }
        : {}),
    });
    return sendControllerResponse(
      reply,
      RevokeUserSessionPresenter.toPresentation(result),
    );
  };
}
