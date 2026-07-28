import type { ListCurrentUserSessions } from "@architecture/iam/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import type { AuthenticatedRequest } from "#types/controller-response";

import { ListUserSessionsPresenter } from "./list-user-sessions.presenter.js";

export function createListCurrentUserSessionsController(
  useCase: ListCurrentUserSessions,
) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    const result = await useCase.execute({
      actorUserId: request.auth.userId,
      currentSessionId: request.auth.sessionId,
    });

    return sendControllerResponse(
      reply,
      ListUserSessionsPresenter.toPresentation(result),
    );
  };
}
