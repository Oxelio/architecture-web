import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { RevokeUserSessionHttpContract } from "./revoke-user-session.http.js";

const ParamsSchema = Type.Object({
  sessionId: Type.String({ format: "uuid" }),
});

export interface RevokeCurrentUserSessionRoute {
  Params: Static<typeof ParamsSchema>;
}

export const revokeCurrentUserSessionRouteOptions = {
  schema: {
    tags: ["IAM"],
    summary: "Revoke one of the current user's sessions",
    params: ParamsSchema,
    response: {
      ...createHttpSuccessResponseSchemas(
        RevokeUserSessionHttpContract.success,
      ),
      ...createErrorResponseSchemas(RevokeUserSessionHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
