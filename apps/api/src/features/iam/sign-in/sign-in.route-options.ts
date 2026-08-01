// @file apps/api/src/features/iam/sign-in/sign-in.route-options.ts

import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { SignInHttpContract } from "./sign-in.http.js";

export interface SignInRoute {
  Body: Static<typeof SignInBodySchema>;
}

const SignInBodySchema = Type.Object({
  login: Type.Object({
    kind: Type.Union([Type.Literal("username"), Type.Literal("email")]),
    value: Type.String({
      minLength: 1,
      maxLength: 254,
    }),
  }),
  password: Type.String(),
});

export const signInRouteOptions = {
  schema: {
    tags: ["IAM"],

    summary: "Sign in",

    body: SignInBodySchema,

    response: {
      ...createHttpSuccessResponseSchemas(SignInHttpContract.success),

      ...createErrorResponseSchemas(SignInHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
