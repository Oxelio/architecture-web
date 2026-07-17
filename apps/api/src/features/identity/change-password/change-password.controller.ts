// @file apps/api/src/features/identity/change-password/change-password.controller.ts

import type {
  ChangePasswordInput,
  ChangePasswordUseCase,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";
import { type AuthenticatedRequest } from "../../../types/controller-response.js";
import { ChangePasswordPresenter } from "./change-password.presenter.js";
import { sendControllerResponse } from "../../../helpers/send-response.js";

type ChangePasswordHTTPRequest = AuthenticatedRequest;

export function createChangePasswordController(useCase: ChangePasswordUseCase) {
  return async (request: ChangePasswordHTTPRequest, reply: FastifyReply) => {
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
  };
}
