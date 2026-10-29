import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { RevokeUserSessionHttpContract } from "./revoke-user-session.http.js";

const ParamsSchema = Type.Object({
  userId: Type.String({ format: "uuid" }),
  sessionId: Type.Optional(Type.String({ format: "uuid" })),
});

export interface RevokeUserSessionRoute {
  Params: Static<typeof ParamsSchema>;
}

export const revokeUserSessionRouteOptions = {
  schema: {
    tags: ["IAM administration"],
    summary: "Revoke one or all of a user's sessions",
    params: ParamsSchema,
    response: {
      ...createHttpSuccessResponseSchemas(
        RevokeUserSessionHttpContract.success,
      ),
      ...createErrorResponseSchemas(RevokeUserSessionHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
