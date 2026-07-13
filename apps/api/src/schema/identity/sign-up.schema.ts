import {
  SignUpHttpErrors,
  SignUpHttpSuccess,
} from "#presentation/sign-up.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";
import { Type } from "@sinclair/typebox";

export const SignUpBodySchema = Type.Object({
  email: Type.String({
    format: "email",
  }),
  password: Type.String({
    minLength: 8,
  }),
});

export const signUpSchema = {
  tags: ["Identity"],

  summary: "Sign up",

  body: SignUpBodySchema,

  response: {
    ...createHttpSuccessResponseSchemas(SignUpHttpSuccess),

    ...createErrorResponseSchemas(SignUpHttpErrors),
  },
};
