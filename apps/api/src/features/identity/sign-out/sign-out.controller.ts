// @file apps/api/src/features/identity/sign-out/sign-out.controller.ts

import type { SignOut, SignOutInput } from "@architecture/identity/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import type { SessionCookieOptions } from "../sign-in/sign-in.controller.js";
import { SignOutPresenter } from "./sign-out.presenter.js";

export function createSignOutController(
  useCase: SignOut,
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
