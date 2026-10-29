// @file apps/api/src/types/controller-response.ts

import type { FastifyRequest, RouteGenericInterface } from "fastify";

import type { AuthenticatedContext } from "#app/auth";

export interface ControllerResponse {
  status: number;
  body?: unknown;
}

export type AuthenticatedRequest<
  TRouteGeneric extends RouteGenericInterface = RouteGenericInterface,
> = FastifyRequest<TRouteGeneric> & {
  auth: AuthenticatedContext | null;
};
