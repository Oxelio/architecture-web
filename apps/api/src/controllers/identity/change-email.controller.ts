// @file apps/api/src/controllers/identity/change-email.controller.ts

import type {
  ChangeEmailInput,
  ChangeEmailUseCase,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";

import { ChangeEmailPresenter } from "#presentation/change-email.presenter";

import {
  type AuthenticatedRequest,
  sendControllerResponse,
} from "./controller-response.js";

type ChangeEmailHTTPRequest = AuthenticatedRequest;

export function buildChangeEmailController(useCase: ChangeEmailUseCase) {
  return {
    handle: async (request: ChangeEmailHTTPRequest, reply: FastifyReply) => {
      const auth = request.auth;

      if (!auth) {
        return reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      const { email } = request.body as { email: string };

      const command: ChangeEmailInput = {
        userId: auth.userId,
        email,
      };

      const result = await useCase.execute(command);

      const response = ChangeEmailPresenter.toPresentation(result);

      return sendControllerResponse(reply, response);
    },
  };
}
