import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticateUserUseCase } from "#application/use-cases/authenticate-user/authenticate-user.use-case";
import { AuthenticateUserPresenter } from "#presentation/http/presenters/authenticate-user.presenter";
import type { CookieSerializeOptions } from "@fastify/cookie";

export interface SessionCookieOptions {
  name: string;
  options: CookieSerializeOptions;
}

export function buildAuthenticateUserController(
  useCase: AuthenticateUserUseCase,
  sessionCookie: SessionCookieOptions,
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
      const maxAge = Math.max(
        1,
        Math.floor(
          (result.value.sessionExpiresAt.getTime() - Date.now()) / 1000,
        ),
      );

      reply.setCookie(sessionCookie.name, result.value.sessionId, {
        ...sessionCookie.options,
        maxAge,
      });

      return reply.status(response.status).send(response.body);
    },
  };
}
