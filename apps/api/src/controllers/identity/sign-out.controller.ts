// @file apps/api/src/controllers/identity/sign-out.controller.ts

import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  SignOutInput,
  SignOutUseCase,
} from "@architecture/identity/application";
import { SignOutPresenter } from "#presentation/sign-out.presenter";
import type { SessionCookieOptions } from "./sign-in.controller.js";
import { sendControllerResponse } from "./controller-response.js";

export function buildSignOutController(
  useCase: SignOutUseCase,
  sessionCookie: SessionCookieOptions,
) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.cookies[sessionCookie.name];

      const command: SignOutInput = {
        sessionId: sessionId ?? "",
      };

      const result = await useCase.execute(command);

      const response = SignOutPresenter.toPresentation(result);

      reply.clearCookie(sessionCookie.name, sessionCookie.options);

      return sendControllerResponse(reply, response);
    },
  };
}
