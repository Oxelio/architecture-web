// @file apps/api/src/controllers/identity/change-password.controller.ts

import type {
  ChangePasswordInput,
  ChangePasswordUseCase,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";

import { ChangePasswordPresenter } from "#presentation/change-password.presenter";

import {
  type AuthenticatedRequest,
  sendControllerResponse,
} from "./controller-response.js";

type ChangePasswordHTTPRequest = AuthenticatedRequest;

export function buildChangePasswordController(useCase: ChangePasswordUseCase) {
  return {
    handle: async (request: ChangePasswordHTTPRequest, reply: FastifyReply) => {
      const auth = request.auth;

      if (!auth) {
        return reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      const { password } = request.body as { password: string };

      const command: ChangePasswordInput = {
        userId: auth.userId,
        password,
      };

      const result = await useCase.execute(command);

      const response = ChangePasswordPresenter.toPresentation(result);

      return sendControllerResponse(reply, response);
    },
  };
}
