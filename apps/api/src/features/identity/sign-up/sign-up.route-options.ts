// @file apps/api/src/features/identity/sign-up/sign-up.route-options.ts
// @file apps/api/src/schema/identity/sign-up.schema.ts

import { Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
import { SignUpHttpContract } from "./sign-up.http.js";

export const SignUpBodySchema = Type.Object({
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
