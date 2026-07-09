// apps/api/src/controllers/identity/activate-user.controller.ts

import type { FastifyReply, FastifyRequest } from "fastify";
import type { ActivateUserUseCase } from "@architecture/identity/application";
import { ActivateUserPresenter } from "#presentation/activate-user.presenter";
import type { ActivateUserParamsSchema } from "#schema/identity/activate-user.schema";
import type { Static } from "@sinclair/typebox";

export type ActivateUserParams = Static<typeof ActivateUserParamsSchema>;

export function buildActivateUserController(useCase: ActivateUserUseCase) {
  return {
    handle: async (
      request: FastifyRequest<{
        Params: ActivateUserParams;
      }>,
      reply: FastifyReply,
    ) => {
      const command = {
        userId: request.params.userId,
      };

      const result = await useCase.execute(command);

      if (!result.success) {
        const response = ActivateUserPresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = ActivateUserPresenter.toSuccessHttp();
      return reply.status(response.status).send(response.body);
    },
  };
}
