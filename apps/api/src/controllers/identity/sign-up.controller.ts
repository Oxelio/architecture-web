// @file apps/api/src/controllers/identity/sign-up.controller.ts

import type {
  SignUpInput,
  SignUpUseCase,
} from "@architecture/identity/application";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import { SignUpPresenter } from "#presentation/sign-up.presenter";
import type { SignUpBodySchema } from "#schema/identity/sign-up.schema";

import { sendControllerResponse } from "./controller-response.js";

export type SignUpBody = Static<typeof SignUpBodySchema>;

type SignUpHTTPRequest = FastifyRequest<{
  Body: SignUpBody;
}>;

export function buildSignUpController(useCase: SignUpUseCase) {
  return {
    handle: async (request: SignUpHTTPRequest, reply: FastifyReply) => {
      const command: SignUpInput = {
        email: request.body.email,
        password: request.body.password,
      };

      const result = await useCase.execute(command);

      const response = SignUpPresenter.toPresentation(result);

      return sendControllerResponse(reply, response);
    },
  };
}
