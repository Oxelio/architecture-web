// @file apps/api/src/features/identity/change-email/change-email.controller.ts

import type {
  ChangeEmail,
  ChangeEmailInput,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import { type AuthenticatedRequest } from "#types/controller-response";

import { ChangeEmailPresenter } from "./change-email.presenter.js";
import type { ChangeEmailRoute } from "./change-email.route-options.js";

type ChangeEmailHTTPRequest = AuthenticatedRequest<ChangeEmailRoute>;

export function createChangeEmailController(useCase: ChangeEmail) {
  return async (request: ChangeEmailHTTPRequest, reply: FastifyReply) => {
    const auth = request.auth;

    if (!auth) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    const { email } = request.body;

    const command: ChangeEmailInput = {
      userId: auth.userId,
      email,
    };

    const result = await useCase.execute(command);

    const response = ChangeEmailPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
