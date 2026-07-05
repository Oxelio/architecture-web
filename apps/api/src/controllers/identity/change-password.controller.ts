import type { FastifyReply, FastifyRequest } from "fastify";
import type { ChangePasswordUseCase } from "@architecture/identity/application";
import { ChangePasswordPresenter } from "#presentation/change-password.presenter";

interface AuthenticatedRequest extends FastifyRequest {
  auth: {
    userId: string;
    sessionId: string;
  };
}

export function buildChangePasswordController(useCase: ChangePasswordUseCase) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { auth } = request as AuthenticatedRequest;
      const { password } = request.body as { password: string };

      const result = await useCase.execute({
        userId: auth.userId,
        password,
      });

      if (!result.success) {
        const response = ChangePasswordPresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = ChangePasswordPresenter.toSuccessHttp();
      return reply.status(response.status).send(response.body);
    },
  };
}
