// @file apps/api/src/features/identity/verify-email/verify-email.route-options.ts

import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { VerifyEmailHttpContract } from "./verify-email.http.js";

export interface VerifyEmailRoute {
  Querystring: Static<typeof VerifyEmailQuerySchema>;
}

const VerifyEmailQuerySchema = Type.Object({
  token: Type.String({
    minLength: 1,
  }),
});

export const verifyEmailRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Verify email",

    querystring: VerifyEmailQuerySchema,

    response: {
      ...createHttpSuccessResponseSchemas(VerifyEmailHttpContract.success),

      ...createErrorResponseSchemas(VerifyEmailHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
