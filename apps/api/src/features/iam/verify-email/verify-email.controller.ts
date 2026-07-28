// @file apps/api/src/features/iam/verify-email/verify-email.controller.ts

import type {
  VerifyEmail,
  VerifyEmailInput,
} from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";

import { VerifyEmailPresenter } from "./verify-email.presenter.js";
import type { VerifyEmailRoute } from "./verify-email.route-options.js";

type VerifyEmailHTTPRequest = FastifyRequest<VerifyEmailRoute>;

export function createVerifyEmailController(useCase: VerifyEmail) {
  return async (request: VerifyEmailHTTPRequest, reply: FastifyReply) => {
    const command: VerifyEmailInput = {
      token: request.query.token,
    };

    const result = await useCase.execute(command);

    const response = VerifyEmailPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
