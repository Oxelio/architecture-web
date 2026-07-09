// apps/api/src/controllers/identity/resend-email-verification.controller.ts

import type { FastifyReply, FastifyRequest } from "fastify";

import type { ResendEmailVerificationUseCase } from "@architecture/identity/application";

import { ResendEmailVerificationPresenter } from "#presentation/resend-email-verification.presenter";

interface AuthenticatedRequest extends FastifyRequest {
  auth: {
    userId: string;
    sessionId: string;
  };
}

export function buildResendEmailVerificationController(
  useCase: ResendEmailVerificationUseCase,
) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { auth } = request as AuthenticatedRequest;

      const result = await useCase.execute({
        userId: auth.userId,
      });

      if (!result.success) {
        const response = ResendEmailVerificationPresenter.toFailureHttp(
          result.error,
        );

        return reply.status(response.status).send(response.body);
      }

      const response = ResendEmailVerificationPresenter.toSuccessHttp();

      return reply.status(response.status).send(response.body);
    },
  };
}
