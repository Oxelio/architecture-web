// @file apps/api/src/features/identity/sign-up/sign-up.controller.ts

import type {
  SignUpInput,
  SignUpUseCase,
} from "@architecture/identity/application";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "../../../helpers/send-response.js";
import { SignUpPresenter } from "./sign-up.presenter.js";
import type { SignUpBodySchema } from "./sign-up.route-options.js";

export type SignUpBody = Static<typeof SignUpBodySchema>;

type SignUpHTTPRequest = FastifyRequest<{
  Body: SignUpBody;
}>;

export function createSignUpController(useCase: SignUpUseCase) {
  return async (request: SignUpHTTPRequest, reply: FastifyReply) => {
    const command: SignUpInput = {
      email: request.body.email,
      password: request.body.password,
    };

    const result = await useCase.execute(command);

    const response = SignUpPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
