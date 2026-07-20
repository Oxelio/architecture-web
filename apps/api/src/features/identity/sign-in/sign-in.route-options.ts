// @file apps/api/src/features/identity/sign-in/sign-in.route-options.ts

import { Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
import { SignInHttpContract } from "./sign-in.http.js";

export const SignInBodySchema = Type.Object({
  email: Type.String({
    format: "email",
  }),
  password: Type.String(),
});

export const signInRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Sign in",

    body: SignInBodySchema,

    response: {
      ...createHttpSuccessResponseSchemas(SignInHttpContract.success),

      ...createErrorResponseSchemas(SignInHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
