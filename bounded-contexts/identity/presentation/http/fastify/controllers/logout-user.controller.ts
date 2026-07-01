import type { LogoutUserUseCase } from "#application/use-cases/logout-user/logout-user.use-case";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionCookieOptions } from "./authenticate-user.controller.js";

export function buildLogoutUserController(
  useCase: LogoutUserUseCase,
  sessionCookie: SessionCookieOptions,
) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.cookies[sessionCookie.name];

      await useCase.execute({
        sessionId: sessionId ?? "",
      });

      reply.clearCookie(sessionCookie.name, sessionCookie.options);

      return reply.status(204).send();
    },
  };
}
