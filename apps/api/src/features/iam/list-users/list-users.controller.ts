import type { ListUsers } from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { ListUsersPresenter } from "./list-users.presenter.js";
import type { ListUsersRoute } from "./list-users.route-options.js";

export function createListUsersController(useCase: ListUsers) {
  return async (
    request: FastifyRequest<ListUsersRoute>,
    reply: FastifyReply,
  ) => {
    const { search, role, status, emailVerified, page, pageSize } =
      request.query;
    const result = await useCase.execute({
      actorUserId: request.auth?.userId ?? "",
      ...(search === undefined ? {} : { search }),
      ...(role === undefined ? {} : { role }),
      ...(status === undefined ? {} : { status }),
      ...(emailVerified === undefined
        ? {}
        : { isEmailVerified: emailVerified }),
      ...(page === undefined ? {} : { page }),
      ...(pageSize === undefined ? {} : { pageSize }),
    });
    return sendControllerResponse(
      reply,
      ListUsersPresenter.toPresentation(result),
    );
  };
}
