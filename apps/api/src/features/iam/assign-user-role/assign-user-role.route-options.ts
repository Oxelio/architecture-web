import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { AssignUserRoleHttpContract } from "./assign-user-role.http.js";

export interface AssignUserRoleRoute {
  Params: Static<typeof AssignUserRoleParamsSchema>;
  Body: Static<typeof AssignUserRoleBodySchema>;
}

const AssignUserRoleParamsSchema = Type.Object({
  userId: Type.String({ format: "uuid" }),
});

const AssignUserRoleBodySchema = Type.Object({
  role: Type.Union([Type.Literal("user"), Type.Literal("admin")]),
});

export const assignUserRoleRouteOptions = {
  schema: {
    tags: ["IAM"],
    summary: "Assign user role",
    params: AssignUserRoleParamsSchema,
    body: AssignUserRoleBodySchema,
    response: {
      ...createHttpSuccessResponseSchemas(AssignUserRoleHttpContract.success),
      ...createErrorResponseSchemas(AssignUserRoleHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
