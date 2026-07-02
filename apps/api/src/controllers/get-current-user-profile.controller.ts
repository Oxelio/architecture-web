// apps/api/src/controllers/get-my-profile.controller.ts

import type { FastifyReply, FastifyRequest } from "fastify";
import type { GetCurrentUserProfileUseCase } from "@architecture/identity/application";
import { GetCurrentUserProfilePresenter } from "../presentation/get-current-user-profile.presenter.js";

interface AuthenticatedRequest extends FastifyRequest {
  auth: {
    userId: string;
    sessionId: string;
  };
}

export function buildGetCurrentUserProfileController(
  useCase: GetCurrentUserProfileUseCase,
) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { auth } = request as AuthenticatedRequest;

      const result = await useCase.execute({ userId: auth.userId });

      if (!result.success) {
        const response = GetCurrentUserProfilePresenter.toFailureHttp(
          result.error,
        );
        return reply.status(response.status).send(response.body);
      }

      const response = GetCurrentUserProfilePresenter.toSuccessHttp(
        result.value,
      );
      return reply.status(response.status).send(response.body);
    },
  };
}
