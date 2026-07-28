// @file apps/api/src/features/iam/get-current-account/get-current-account.controller.ts

import type {
  GetCurrentAccount,
  GetCurrentAccountInput,
} from "@architecture/iam/application";
import type { FastifyReply } from "fastify";

import { sendControllerResponse } from "#helpers/send-response";
import { type AuthenticatedRequest } from "#types/controller-response";

import { GetCurrentAccountPresenter } from "./get-current-account.presenter.js";

type GetCurrentAccountHTTPRequest = AuthenticatedRequest;

export function createGetCurrentAccountController(useCase: GetCurrentAccount) {
  return async (request: GetCurrentAccountHTTPRequest, reply: FastifyReply) => {
    const auth = request.auth;

    if (!auth) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    const command: GetCurrentAccountInput = {
      actorUserId: auth.userId,
    };

    const result = await useCase.execute(command);

    const response = GetCurrentAccountPresenter.toPresentation(result);

    return sendControllerResponse(reply, response);
  };
}
