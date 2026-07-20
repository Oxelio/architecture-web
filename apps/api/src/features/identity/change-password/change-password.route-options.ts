// @file apps/api/src/features/identity/change-password/change-password.route-options.ts

import { Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
import { ChangePasswordHttpContract } from "./change-password.http.js";

export const ChangePasswordBodySchema = Type.Object({
  password: Type.String({
    minLength: 8,
  }),
});

export const changePasswordRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Change password",

    body: ChangePasswordBodySchema,

    response: {
      ...createHttpSuccessResponseSchemas(ChangePasswordHttpContract.success),

      ...createErrorResponseSchemas(ChangePasswordHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
