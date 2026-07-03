import type { FastifyReply, FastifyRequest } from "fastify";
import { SignUpUseCase } from "@architecture/identity/application";
import { SignUpPresenter } from "../presentation/sign-up.presenter.js";

export function buildSignUpController(useCase: SignUpUseCase) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const result = await useCase.execute({
        email,
        password,
      });

      if (!result.success) {
        const response = SignUpPresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = SignUpPresenter.toSuccessHttp(result.value);
      return reply.status(response.status).send(response.body);
    },
  };
}
