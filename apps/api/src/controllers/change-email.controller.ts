import type { FastifyReply, FastifyRequest } from "fastify";
import type { ChangeEmailUseCase } from "@architecture/identity/application";
import { ChangeEmailPresenter } from "../presentation/change-email.presenter.js";

interface AuthenticatedRequest extends FastifyRequest {
  auth: {
    userId: string;
    sessionId: string;
  };
}

export function buildChangeEmailController(useCase: ChangeEmailUseCase) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { auth } = request as AuthenticatedRequest;
      const { email } = request.body as { email: string };

      const result = await useCase.execute({
        userId: auth.userId,
        email,
      });

      if (!result.success) {
        const response = ChangeEmailPresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = ChangeEmailPresenter.toSuccessHttp();
      return reply.status(response.status).send(response.body);
    },
  };
}
