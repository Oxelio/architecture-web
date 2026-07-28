// @file apps/api/src/features/iam/resend-email-verification/resend-email-verification.controller.ts

import type {
  ResendEmailVerification,
  ResendEmailVerificationInput,
} from "@architecture/iam/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import { type AuthenticatedRequest } from "#types/controller-response";

import { ResendEmailVerificationPresenter } from "./resend-email-verification.presenter.js";

type ResendEmailVerificationHTTPRequest = AuthenticatedRequest;

export function createResendEmailVerificationController(
  useCase: ResendEmailVerification,
) {
  return async (
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
  };
}
