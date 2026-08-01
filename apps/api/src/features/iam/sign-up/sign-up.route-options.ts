// @file apps/api/src/features/iam/sign-up/sign-up.route-options.ts

import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { SignUpHttpContract } from "./sign-up.http.js";

export interface SignUpRoute {
  Body: Static<typeof SignUpBodySchema>;
}

const SignUpBodySchema = Type.Object({
  login: Type.Object({
    kind: Type.Union([Type.Literal("username"), Type.Literal("email")]),
    value: Type.String({
      minLength: 1,
      maxLength: 254,
    }),
  }),
  password: Type.String({
    maxLength: 1024,
  }),
  passwordConfirmation: Type.String({
    maxLength: 1024,
  }),
});

export const signUpRouteOptions = {
  schema: {
    tags: ["IAM"],

    summary: "Sign up",

    body: SignUpBodySchema,

    response: {
      ...createHttpSuccessResponseSchemas(SignUpHttpContract.success),

      201: Type.Object({
        data: Type.Object({
          userId: Type.String(),
        }),
      }),

      ...createErrorResponseSchemas(SignUpHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
