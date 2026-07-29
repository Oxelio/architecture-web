import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { ListUsersHttpContract } from "./list-users.http.js";

export interface ListUsersRoute {
  Querystring: Static<typeof ListUsersQuerySchema>;
}

const ListUsersQuerySchema = Type.Object({
  search: Type.Optional(Type.String({ maxLength: 200 })),
  role: Type.Optional(
    Type.Union([Type.Literal("user"), Type.Literal("admin")]),
  ),
  status: Type.Optional(
    Type.Union([Type.Literal("active"), Type.Literal("suspended")]),
  ),
  emailVerified: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 100, default: 25 }),
  ),
});

const AdminUserSchema = Type.Object({
  userId: Type.String(),
  email: Type.String({ format: "email" }),
  role: Type.Union([Type.Literal("user"), Type.Literal("admin")]),
  status: Type.Union([Type.Literal("active"), Type.Literal("suspended")]),
  isEmailVerified: Type.Boolean(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export const listUsersRouteOptions = {
  schema: {
    tags: ["IAM administration"],
    summary: "Search and paginate users",
    querystring: ListUsersQuerySchema,
    response: {
      ...createHttpSuccessResponseSchemas(ListUsersHttpContract.success),
      200: Type.Object({
        data: Type.Array(AdminUserSchema),
        meta: Type.Object({
          pagination: Type.Object({
            page: Type.Integer(),
            pageSize: Type.Integer(),
            total: Type.Integer(),
            totalPages: Type.Integer(),
          }),
        }),
      }),
      ...createErrorResponseSchemas(ListUsersHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
