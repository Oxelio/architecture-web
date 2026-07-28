// @file apps/api/src/features/iam/sign-up/sign-up.controller.ts

import type { SignUp, SignUpInput } from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { SignUpPresenter } from "./sign-up.presenter.js";
import type { SignUpRoute } from "./sign-up.route-options.js";

type SignUpHTTPRequest = FastifyRequest<SignUpRoute>;

export function createSignUpController(useCase: SignUp) {
  return async (request: SignUpHTTPRequest, reply: FastifyReply) => {
    const command: SignUpInput = {
      email: request.body.email,
      password: request.body.password,
      passwordConfirmation: request.body.passwordConfirmation,
    };

    const result = await useCase.execute(command);

    const response = SignUpPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
