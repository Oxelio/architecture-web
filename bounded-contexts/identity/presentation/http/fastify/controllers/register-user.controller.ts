import type { FastifyReply, FastifyRequest } from "fastify";
import { RegisterUserPresenter } from "../../presenters/register-user.presenter.js";
import { RegisterUserUseCase } from "@architecture/identity/application";

export function buildRegisterUserController(useCase: RegisterUserUseCase) {
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
        const response = RegisterUserPresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = RegisterUserPresenter.toSuccessHttp(result.value);
      return reply.status(response.status).send(response.body);
    },
  };
}
