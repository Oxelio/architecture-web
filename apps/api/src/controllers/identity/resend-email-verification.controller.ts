// @file apps/api/src/controllers/identity/resend-email-verification.controller.ts

import type {
  ResendEmailVerificationInput,
  ResendEmailVerificationUseCase,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";

import { ResendEmailVerificationPresenter } from "#presentation/resend-email-verification.presenter";

import {
  type AuthenticatedRequest,
  sendControllerResponse,
} from "./controller-response.js";

type ResendEmailVerificationHTTPRequest = AuthenticatedRequest;

export function buildResendEmailVerificationController(
  useCase: ResendEmailVerificationUseCase,
) {
  return {
    handle: async (
      request: ResendEmailVerificationHTTPRequest,
      reply: FastifyReply,
    ) => {
      const auth = request.auth;

      if (!auth) {
        return reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      const command: ResendEmailVerificationInput = {
        userId: auth.userId,
      };

      const result = await useCase.execute(command);

      const response = ResendEmailVerificationPresenter.toPresentation(result);

      return sendControllerResponse(reply, response);
    },
  };
}
