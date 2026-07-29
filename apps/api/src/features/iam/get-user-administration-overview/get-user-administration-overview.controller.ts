import type { GetUserAdministrationOverview } from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { GetUserAdministrationOverviewPresenter } from "./get-user-administration-overview.presenter.js";

export function createGetUserAdministrationOverviewController(
  useCase: GetUserAdministrationOverview,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await useCase.execute({
      actorUserId: request.auth?.userId ?? "",
    });
    return sendControllerResponse(
      reply,
      GetUserAdministrationOverviewPresenter.toPresentation(result),
    );
  };
}
