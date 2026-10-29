import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { ListUserSessionsHttpContract } from "./list-user-sessions.http.js";

export const listCurrentUserSessionsRouteOptions = {
  schema: {
    tags: ["IAM"],
    summary: "List the current user's active sessions",
    response: {
      ...createHttpSuccessResponseSchemas(ListUserSessionsHttpContract.success),
      ...createErrorResponseSchemas(ListUserSessionsHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
