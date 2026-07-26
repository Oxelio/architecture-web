// @file apps/api/src/features/identity/activate-user/activate-user.route-options.ts

import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { ActivateUserHttpContract } from "./activate-user.http.js";

export interface ActivateRoute {
  Params: Static<typeof ActivateUserParamsSchema>;
}

export const ActivateUserParamsSchema = Type.Object({
  userId: Type.String({
    format: "uuid",
  }),
});

export const activateUserRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Activate user",

    params: ActivateUserParamsSchema,

    response: {
      ...createHttpSuccessResponseSchemas(ActivateUserHttpContract.success),

      ...createErrorResponseSchemas(ActivateUserHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
