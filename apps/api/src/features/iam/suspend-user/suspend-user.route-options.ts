// @file apps/api/src/features/iam/suspend-user/suspend-user.route-options.ts

import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { SuspendUserHttpContract } from "./suspend-user.http.js";

export interface SuspendUserRoute {
  Params: Static<typeof SuspendUserParamsSchema>;
}

const SuspendUserParamsSchema = Type.Object({
  userId: Type.String({
    format: "uuid",
  }),
});

export const suspendUserRouteOptions = {
  schema: {
    tags: ["IAM"],

    summary: "Suspend user",

    params: SuspendUserParamsSchema,

    response: {
      ...createHttpSuccessResponseSchemas(SuspendUserHttpContract.success),

      ...createErrorResponseSchemas(SuspendUserHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
