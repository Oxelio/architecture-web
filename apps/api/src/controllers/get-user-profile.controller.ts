// apps/api/src/controllers/get-my-profile.controller.ts

import type { FastifyReply, FastifyRequest } from "fastify";
import type { GetUserProfileUseCase } from "@architecture/identity/application";
import { GetUserProfilePresenter } from "../presentation/get-user-profile.presenter.js";

interface AuthenticatedRequest extends FastifyRequest {
  auth: {
    userId: string;
    sessionId: string;
  };
}

export function buildGetUserProfileController(useCase: GetUserProfileUseCase) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { auth } = request as AuthenticatedRequest;

      const result = await useCase.execute({ userId: auth.userId });

      if (!result.success) {
        const response = GetUserProfilePresenter.toFailureHttp(result.error);
        return reply.status(response.status).send(response.body);
      }

      const response = GetUserProfilePresenter.toSuccessHttp(result.value);
      return reply.status(response.status).send(response.body);
    },
  };
}
