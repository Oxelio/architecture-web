import type { FastifyReply, FastifyRequest } from "fastify";
import type { SuspendUserUseCase } from "@architecture/identity/application";
import { SuspendUserPresenter } from "../presentation/suspend-user.presenter.js";

interface RouteParams {
  userId: string;
}

export function buildSuspendUserController(useCase: SuspendUserUseCase) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as RouteParams;

      const result = await useCase.execute({ userId });

      if (!result.success) {
        const response = SuspendUserPresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = SuspendUserPresenter.toSuccessHttp();
      return reply.status(response.status).send(response.body);
    },
  };
}
