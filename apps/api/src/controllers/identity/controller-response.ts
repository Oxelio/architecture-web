import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedContext } from "../../auth.js";

export interface ControllerResponse {
  status: number;
  body?: unknown;
}

export type AuthenticatedRequest = FastifyRequest & {
  auth: AuthenticatedContext | null;
};

export function sendControllerResponse(
  reply: FastifyReply,
  response: ControllerResponse,
) {
  if (response.status === 204) {
    return reply.status(204).send();
  }

  return reply.status(response.status).send(response.body);
}
