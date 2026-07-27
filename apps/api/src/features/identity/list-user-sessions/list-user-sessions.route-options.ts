import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { ListUserSessionsHttpContract } from "./list-user-sessions.http.js";

const ParamsSchema = Type.Object({
  userId: Type.String({ format: "uuid" }),
});

export interface ListUserSessionsRoute {
  Params: Static<typeof ParamsSchema>;
}

export const listUserSessionsRouteOptions = {
  schema: {
    tags: ["Identity administration"],
    summary: "List a user's active sessions",
    params: ParamsSchema,
    response: {
      ...createHttpSuccessResponseSchemas(ListUserSessionsHttpContract.success),
      ...createErrorResponseSchemas(ListUserSessionsHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
