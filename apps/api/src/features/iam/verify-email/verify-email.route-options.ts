// @file apps/api/src/features/iam/verify-email/verify-email.route-options.ts

import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { VerifyEmailHttpContract } from "./verify-email.http.js";

export interface VerifyEmailRoute {
  Body: Static<typeof VerifyEmailBodySchema>;
}

const VerifyEmailBodySchema = Type.Object(
  {
    token: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const verifyEmailRouteOptions = {
  schema: {
    tags: ["IAM"],

    summary: "Verify email",

    body: VerifyEmailBodySchema,

    response: {
      ...createHttpSuccessResponseSchemas(VerifyEmailHttpContract.success),

      ...createErrorResponseSchemas(VerifyEmailHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
