// @file apps/api/src/types/controller-response.ts

import type { FastifyRequest } from "fastify";

import type { AuthenticatedContext } from "../auth.js";

export interface ControllerResponse {
  status: number;
  body?: unknown;
}

export type AuthenticatedRequest = FastifyRequest & {
  auth: AuthenticatedContext | null;
};
