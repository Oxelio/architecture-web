// apps/api/src/controllers/identity/activate-user.controller.ts

import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  ActivateUserCommand,
  ActivateUserUseCase,
} from "@architecture/identity/application";
import { ActivateUserPresenter } from "#presentation/activate-user.presenter";
import type { ActivateUserParamsSchema } from "#schema/identity/activate-user.schema";
import type { Static } from "@sinclair/typebox";

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

      return reply.status(response.status).send();
    },
  };
}
