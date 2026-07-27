import type { ListUsers } from "@architecture/identity/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { ListUsersPresenter } from "./list-users.presenter.js";

export function createListUsersController(useCase: ListUsers) {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await useCase.execute();
    return sendControllerResponse(
      reply,
      ListUsersPresenter.toPresentation(result),
    );
  };
}
