// @file apps/api/src/features/identity/change-password/change-password.controller.ts

import type {
  ChangePassword,
  ChangePasswordInput,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import { type AuthenticatedRequest } from "#types/controller-response";

import { ChangePasswordPresenter } from "./change-password.presenter.js";
import type { ChangePasswordRoute } from "./change-password.route-options.js";

type ChangePasswordHTTPRequest = AuthenticatedRequest<ChangePasswordRoute>;

export function createChangePasswordController(useCase: ChangePassword) {
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

    const { currentPassword, password, passwordConfirmation } = request.body;

    const command: ChangePasswordInput = {
      userId: auth.userId,
      currentPassword,
      password,
      passwordConfirmation,
    };

    const result = await useCase.execute(command);

    const response = ChangePasswordPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
