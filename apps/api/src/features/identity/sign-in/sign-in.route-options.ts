// @file apps/api/src/features/identity/sign-in/sign-in.route-options.ts

import { Type } from "@sinclair/typebox";

import type { RouteShorthandOptions } from "fastify";
import { SignInHttpSuccess, SignInHttpErrors } from "./sign-in.presenter.js";
import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";

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
      ...createHttpSuccessResponseSchemas(SignInHttpSuccess),

      ...createErrorResponseSchemas(SignInHttpErrors),
    },
  },
} satisfies RouteShorthandOptions;
