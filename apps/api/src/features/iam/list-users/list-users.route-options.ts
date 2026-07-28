import type { RouteShorthandOptions } from "fastify";

import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { ListUsersHttpContract } from "./list-users.http.js";

export const listUsersRouteOptions = {
  schema: {
    tags: ["IAM administration"],
    summary: "List all users",
    response: createHttpSuccessResponseSchemas(ListUsersHttpContract.success),
  },
} satisfies RouteShorthandOptions;
