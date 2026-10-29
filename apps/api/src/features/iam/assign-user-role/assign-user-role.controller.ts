import type {
  AssignUserRole,
  AssignUserRoleInput,
} from "@architecture/iam/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import type { AuthenticatedRequest } from "#types/controller-response";

import { AssignUserRolePresenter } from "./assign-user-role.presenter.js";
import type { AssignUserRoleRoute } from "./assign-user-role.route-options.js";

type AssignUserRoleHTTPRequest = AuthenticatedRequest<AssignUserRoleRoute>;

export function createAssignUserRoleController(useCase: AssignUserRole) {
  return async (request: AssignUserRoleHTTPRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply
        .status(401)
        .send({ error: { code: "authentication.unauthorized" } });
    }

    const command: AssignUserRoleInput = {
      userId: request.params.userId,
      actorUserId: request.auth.userId,
      role: request.body.role,
    };
    const result = await useCase.execute(command);

    return sendControllerResponse(
      reply,
      AssignUserRolePresenter.toPresentation(result),
    );
  };
}
