import type { FastifyReply, FastifyRequest } from "fastify";
import type { ActivateUserUseCase } from "@architecture/identity/application";
import { ActivateUserPresenter } from "../presentation/activate-user.presenter.js";

interface RouteParams {
  userId: string;
}

export function buildActivateUserController(useCase: ActivateUserUseCase) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as RouteParams;

      const result = await useCase.execute({ userId });

      if (!result.success) {
        const response = ActivateUserPresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = ActivateUserPresenter.toSuccessHttp();
      return reply.status(response.status).send(response.body);
    },
  };
}
