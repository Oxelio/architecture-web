// @file apps/api/src/features/identity/change-email/change-email.controller.ts

import type {
  ChangeEmailInput,
  ChangeEmailUseCase,
} from "@architecture/identity/application";
import type { FastifyReply } from "fastify";
import { ChangeEmailPresenter } from "./change-email.presenter.js";
import { type AuthenticatedRequest } from "../../../types/controller-response.js";
import { sendControllerResponse } from "../../../helpers/send-response.js";

type ChangeEmailHTTPRequest = AuthenticatedRequest;

export function createChangeEmailController(useCase: ChangeEmailUseCase) {
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

    const { email } = request.body as { email: string };

    const command: ChangeEmailInput = {
      userId: auth.userId,
      email,
    };

    const result = await useCase.execute(command);

    const response = ChangeEmailPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
