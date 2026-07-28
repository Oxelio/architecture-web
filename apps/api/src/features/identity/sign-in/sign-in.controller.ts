// @file apps/api/src/features/identity/sign-in/sign-in.controller.ts

import type { SignIn, SignInInput } from "@architecture/identity/application";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { sessionMetadataFromRequest } from "./session-request-metadata.js";
import { SignInPresenter } from "./sign-in.presenter.js";
import type { SignInRoute } from "./sign-in.route-options.js";

export interface SessionCookieOptions {
  name: string;
  options: CookieSerializeOptions;
}

type SignInHTTPRequest = FastifyRequest<SignInRoute>;

export function createSignInController(
  useCase: SignIn,
  sessionCookie: SessionCookieOptions,
) {
  return async (request: SignInHTTPRequest, reply: FastifyReply) => {
    const metadata = sessionMetadataFromRequest(request);
    const command: SignInInput = {
      email: request.body.email,
      password: request.body.password,
      client: metadata.client,
      ...(metadata.network ? { network: metadata.network } : {}),
    };

    const result = await useCase.execute(command);

    const response = SignInPresenter.toPresentation(result);

    if (result.success) {
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
    }

    return sendControllerResponse(reply, response);
  };
}
