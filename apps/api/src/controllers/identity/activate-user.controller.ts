// @file apps/api/src/controllers/identity/activate-user.controller.ts

import type {
  ActivateUserCommand,
  ActivateUserUseCase,
} from "@architecture/identity/application";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#controllers/controller-response";
import { ActivateUserPresenter } from "#presentation/activate-user.presenter";
import type { ActivateUserParamsSchema } from "#schema/identity/activate-user.schema";

export type ActivateUserParams = Static<typeof ActivateUserParamsSchema>;

type ActivateUserHTTPRequest = FastifyRequest<{
  Params: ActivateUserParams;
}>;

export function buildActivateUserController(useCase: ActivateUserUseCase) {
  return {
    handle: async (request: ActivateUserHTTPRequest, reply: FastifyReply) => {
      const command: ActivateUserCommand = {
        userId: request.params.userId,
      };

      const result = await useCase.execute(command);

      const response = ActivateUserPresenter.toPresentation(result);

      return sendControllerResponse(reply, response);
    },
  };
}
