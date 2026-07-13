// @file apps/api/src/controllers/identity/verify-email.controller.ts

import type {
  VerifyEmailInput,
  VerifyEmailUseCase,
} from "@architecture/identity/application";
import type { Static } from "@sinclair/typebox";
import type { FastifyReply, FastifyRequest } from "fastify";

import { VerifyEmailPresenter } from "#presentation/verify-email.presenter";
import type { VerifyEmailQuerySchema } from "#schema/identity/verify-email.schema";

import { sendControllerResponse } from "./controller-response.js";

export type VerifyEmailQuery = Static<typeof VerifyEmailQuerySchema>;

type VerifyEmailHTTPRequest = FastifyRequest<{
  Querystring: VerifyEmailQuery;
}>;

export function buildVerifyEmailController(useCase: VerifyEmailUseCase) {
  return {
    handle: async (request: VerifyEmailHTTPRequest, reply: FastifyReply) => {
      const command: VerifyEmailInput = {
        token: request.query.token,
      };

      const result = await useCase.execute(command);

      const response = VerifyEmailPresenter.toPresentation(result);

      return sendControllerResponse(reply, response);
    },
  };
}
