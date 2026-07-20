// @file apps/api/src/features/identity/suspend-user/suspend-user.route-options.ts

import { Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
import { SuspendUserHttpContract } from "./suspend-user.http.js";

export const SuspendUserParamsSchema = Type.Object({
  userId: Type.String({
    format: "uuid",
  }),
});

export const suspendUserRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Suspend user",

    params: SuspendUserParamsSchema,

    response: {
      ...createHttpSuccessResponseSchemas(SuspendUserHttpContract.success),

      ...createErrorResponseSchemas(SuspendUserHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
