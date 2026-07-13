// @file apps/api/src/controllers/identity/sign-in.controller.ts

import type {
  SignInInput,
  SignInUseCase,
} from "@architecture/identity/application";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import { SignInPresenter } from "#presentation/sign-in.presenter";
import type { SignInBodySchema } from "#schema/identity/sign-in.schema";

import { sendControllerResponse } from "./controller-response.js";

export interface SessionCookieOptions {
  name: string;
  options: CookieSerializeOptions;
}

export type SignInBody = Static<typeof SignInBodySchema>;

type SignInHTTPRequest = FastifyRequest<{
  Body: SignInBody;
}>;

export function buildSignInController(
  useCase: SignInUseCase,
  sessionCookie: SessionCookieOptions,
) {
  return {
    handle: async (request: SignInHTTPRequest, reply: FastifyReply) => {
      const command: SignInInput = {
        email: request.body.email,
        password: request.body.password,
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
    },
  };
}
