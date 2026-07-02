import type { FastifyReply, FastifyRequest } from "fastify";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { AuthenticateUserUseCase } from "@architecture/identity/application";
import { AuthenticateUserPresenter } from "../presentation/authenticate-user.presenter.js";

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
