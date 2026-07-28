import type {
  EvaluatePassword,
  GetPasswordPolicy,
} from "@architecture/iam/application";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { EvaluatePasswordRoute } from "./password-policy.route-options.js";

export function createGetPasswordPolicyController(useCase: GetPasswordPolicy) {
  return async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.status(200).send({ data: useCase.execute() });
}

export function createEvaluatePasswordController(useCase: EvaluatePassword) {
  return async (
    request: FastifyRequest<EvaluatePasswordRoute>,
    reply: FastifyReply,
  ) =>
    reply.status(200).send({
      data: await useCase.execute({ password: request.body.password }),
    });
}
