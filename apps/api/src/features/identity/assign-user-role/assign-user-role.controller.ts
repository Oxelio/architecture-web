import type {
  AssignUserRole,
  AssignUserRoleInput,
} from "@architecture/identity/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { AssignUserRolePresenter } from "./assign-user-role.presenter.js";
import type { AssignUserRoleRoute } from "./assign-user-role.route-options.js";

type AssignUserRoleHTTPRequest = FastifyRequest<AssignUserRoleRoute>;

export function createAssignUserRoleController(useCase: AssignUserRole) {
  return async (request: AssignUserRoleHTTPRequest, reply: FastifyReply) => {
    const command: AssignUserRoleInput = {
      userId: request.params.userId,
      role: request.body.role,
    };
    const result = await useCase.execute(command);

    return sendControllerResponse(
      reply,
      AssignUserRolePresenter.toPresentation(result),
    );
  };
}
