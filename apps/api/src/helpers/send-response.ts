// @file apps/api/src/helpers/send-response.ts
import type { FastifyReply } from "fastify";
import type { ControllerResponse } from "../types/controller-response.js";

export function sendControllerResponse(
  reply: FastifyReply,
  response: ControllerResponse,
) {
  if (response.status === 204) {
    return reply.status(204).send();
  }

  return reply.status(response.status).send(response.body);
}
