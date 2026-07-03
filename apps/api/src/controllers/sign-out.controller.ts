import type { FastifyReply, FastifyRequest } from "fastify";
import type { SignOutUseCase } from "@architecture/identity/application";
import type { SessionCookieOptions } from "./sign-in.controller.js";

export function buildSignOutController(
  useCase: SignOutUseCase,
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
