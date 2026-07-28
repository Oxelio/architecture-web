// @file apps/api/src/features/identity/change-password/change-password.route-options.ts

import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { ChangePasswordHttpContract } from "./change-password.http.js";

export interface ChangePasswordRoute {
  Body: Static<typeof ChangePasswordBodySchema>;
}

const ChangePasswordBodySchema = Type.Object({
  currentPassword: Type.String({
    maxLength: 1024,
  }),
  password: Type.String({
    maxLength: 1024,
  }),
  passwordConfirmation: Type.String({
    maxLength: 1024,
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
