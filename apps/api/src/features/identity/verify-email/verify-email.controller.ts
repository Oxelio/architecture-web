// @file apps/api/src/features/identity/verify-email/verify-email.controller.ts

import type {
  VerifyEmailInput,
  VerifyEmailUseCase,
} from "@architecture/identity/application";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sendControllerResponse } from "../../../helpers/send-response.js";
import { VerifyEmailPresenter } from "./verify-email.presenter.js";
import type { VerifyEmailQuerySchema } from "./verify-email.route-options.js";

export type VerifyEmailQuery = Static<typeof VerifyEmailQuerySchema>;

type VerifyEmailHTTPRequest = FastifyRequest<{
  Querystring: VerifyEmailQuery;
}>;

export function createVerifyEmailController(useCase: VerifyEmailUseCase) {
  return async (request: VerifyEmailHTTPRequest, reply: FastifyReply) => {
    const command: VerifyEmailInput = {
      token: request.query.token,
    };

    const result = await useCase.execute(command);

    const response = VerifyEmailPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
