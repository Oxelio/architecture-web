import type { RevokeUserSession } from "@architecture/identity/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import type { AuthenticatedRequest } from "#types/controller-response";

import type { RevokeCurrentUserSessionRoute } from "./revoke-current-user-session.route-options.js";
import { RevokeUserSessionPresenter } from "./revoke-user-session.presenter.js";

export function createRevokeCurrentUserSessionController(
  useCase: RevokeUserSession,
) {
  return async (
    request: AuthenticatedRequest<RevokeCurrentUserSessionRoute>,
    reply: FastifyReply,
  ) => {
    if (!request.auth) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    const result = await useCase.execute({
      userId: request.auth.userId,
      sessionId: request.params.sessionId,
    });

    return sendControllerResponse(
      reply,
      RevokeUserSessionPresenter.toPresentation(result),
    );
  };
}
