import type { RevokeCurrentUserSession } from "@architecture/iam/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import type { SessionCookieOptions } from "#iam/sign-in/sign-in.controller";
import type { AuthenticatedRequest } from "#types/controller-response";

import type { RevokeCurrentUserSessionRoute } from "./revoke-current-user-session.route-options.js";
import { RevokeUserSessionPresenter } from "./revoke-user-session.presenter.js";

export function createRevokeCurrentUserSessionController(
  useCase: RevokeCurrentUserSession,
  sessionCookie: SessionCookieOptions,
) {
  return async (
    request: AuthenticatedRequest<RevokeCurrentUserSessionRoute>,
    reply: FastifyReply,
  ) => {
    if (!request.auth) {
      return reply.status(401).send({
        error: {
          code: "authentication.unauthorized",
          message: "Authentication required",
        },
      });
    }

    const result = await useCase.execute({
      actorUserId: request.auth.userId,
      sessionId: request.params.sessionId,
    });

    if (result.success && request.params.sessionId === request.auth.sessionId) {
      reply.clearCookie(sessionCookie.name, sessionCookie.options);
    }

    return sendControllerResponse(
      reply,
      RevokeUserSessionPresenter.toPresentation(result),
    );
  };
}
