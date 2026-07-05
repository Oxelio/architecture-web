import type { FastifyReply, FastifyRequest } from "fastify";
import type { VerifyEmailUseCase } from "@architecture/identity/application";
import { VerifyEmailPresenter } from "#presentation/verify-email.presenter";

export function buildVerifyEmailController(useCase: VerifyEmailUseCase) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const token = (request.query as any).token as string | undefined;

      if (!token) {
        const response = VerifyEmailPresenter.toFailureHttp({
          kind: "token.invalid",
        });
        return reply.status(response.status).send(response.body);
      }

      const result = await useCase.execute({ token });

      if (!result.success) {
        const response = VerifyEmailPresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = VerifyEmailPresenter.toSuccessHttp();
      return reply.status(response.status).send(response.body);
    },
  };
}
