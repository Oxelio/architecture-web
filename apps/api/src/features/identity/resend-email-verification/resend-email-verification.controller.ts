// @file apps/api/src/features/identity/resend-email-verification/resend-email-verification.controller.ts

import { type AuthenticatedRequest } from "../../../../src/types/controller-response.js";
import type {
  ResendEmailVerificationInput,
  ResendEmailVerificationUseCase,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";
import { ResendEmailVerificationPresenter } from "./resend-email-verification.presenter.js";
import { sendControllerResponse } from "../../../helpers/send-response.js";

type ResendEmailVerificationHTTPRequest = AuthenticatedRequest;

export function createResendEmailVerificationController(
  useCase: ResendEmailVerificationUseCase,
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
