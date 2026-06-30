import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticateUserUseCase } from "#application/use-cases/authenticate-user/authenticate-user.use-case";
import { AuthenticateUserPresenter } from "#presentation/http/presenters/authenticate-user.presenter";

export function buildAuthenticateUserController(
  useCase: AuthenticateUserUseCase,
) {
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
        const response = AuthenticateUserPresenter.toFailureHttp(result.error);

        return reply.status(response.status).send(response.body);
      }

      const response = AuthenticateUserPresenter.toSuccessHttp(result.value);

      return reply.status(response.status).send(response.body);
    },
  };
}
