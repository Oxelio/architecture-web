// @file apps/api/src/schema/identity/sign-in.schema.ts

import { Type } from "@sinclair/typebox";

import {
  SignInHttpErrors,
  SignInHttpSuccess,
} from "#presentation/sign-in.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";

export const SignInBodySchema = Type.Object({
  email: Type.String({
    format: "email",
  }),
  password: Type.String(),
});

export const signInSchema = {
  tags: ["Identity"],

  summary: "Sign in",

  body: SignInBodySchema,

  response: {
    ...createHttpSuccessResponseSchemas(SignInHttpSuccess),

    ...createErrorResponseSchemas(SignInHttpErrors),
  },
};
