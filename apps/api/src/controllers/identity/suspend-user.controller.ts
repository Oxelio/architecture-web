import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  SuspendUserInput,
  SuspendUserUseCase,
} from "@architecture/identity/application";
import { SuspendUserPresenter } from "#presentation/suspend-user.presenter";
import type { SuspendUserParamsSchema } from "#schema/identity/suspend-user.schema";
import type { Static } from "@sinclair/typebox";
import { sendControllerResponse } from "./controller-response.js";

export type SuspendUserParams = Static<typeof SuspendUserParamsSchema>;

type SuspendUserHTTPRequest = FastifyRequest<{
  Params: SuspendUserParams;
}>;

export function buildSuspendUserController(useCase: SuspendUserUseCase) {
  return {
    handle: async (request: SuspendUserHTTPRequest, reply: FastifyReply) => {
      const command: SuspendUserInput = {
        userId: request.params.userId,
      };

      const result = await useCase.execute(command);

      const response = SuspendUserPresenter.toPresentation(result);

      return sendControllerResponse(reply, response);
    },
  };
}
