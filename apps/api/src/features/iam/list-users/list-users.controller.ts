import type { ListUsers } from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { ListUsersPresenter } from "./list-users.presenter.js";

export function createListUsersController(useCase: ListUsers) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await useCase.execute({
      actorUserId: request.auth?.userId ?? "",
    });
    return sendControllerResponse(
      reply,
      ListUsersPresenter.toPresentation(result),
    );
  };
}
