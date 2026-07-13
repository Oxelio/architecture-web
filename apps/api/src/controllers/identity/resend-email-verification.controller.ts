import type { FastifyReply } from "fastify";
import type {
  ResendEmailVerificationInput,
  ResendEmailVerificationUseCase,
} from "@architecture/identity/application";
import { ResendEmailVerificationPresenter } from "#presentation/resend-email-verification.presenter";
import {
  sendControllerResponse,
  type AuthenticatedRequest,
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
