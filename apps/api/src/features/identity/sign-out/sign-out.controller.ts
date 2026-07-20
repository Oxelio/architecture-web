// @file apps/api/src/features/identity/sign-out/sign-out.controller.ts

import type {
  SignOutInput,
  SignOutUseCase,
} from "@architecture/identity/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "../../../helpers/send-response.js";
import type { SessionCookieOptions } from "../sign-in/sign-in.controller.js";
import { SignOutPresenter } from "./sign-out.presenter.js";

export function createSignOutController(
  useCase: SignOutUseCase,
  sessionCookie: SessionCookieOptions,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies[sessionCookie.name];

    const command: SignOutInput = {
      sessionId: sessionId ?? "",
    };

    const result = await useCase.execute(command);

    const response = SignOutPresenter.toPresentation(result);

    reply.clearCookie(sessionCookie.name, sessionCookie.options);

    return sendControllerResponse(reply, response);
  };
}
