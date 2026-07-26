// @file apps/api/src/features/identity/sign-up/sign-up.route-options.ts

import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { SignUpHttpContract } from "./sign-up.http.js";

export interface SignUpRoute {
  Body: Static<typeof SignUpBodySchema>;
}

const SignUpBodySchema = Type.Object({
  email: Type.String({
    format: "email",
  }),
  password: Type.String({
    minLength: 8,
  }),
});

export const signUpRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Sign up",

    body: SignUpBodySchema,

    response: {
      ...createHttpSuccessResponseSchemas(SignUpHttpContract.success),

      ...createErrorResponseSchemas(SignUpHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
