// @file apps/api/src/schema/identity/verify-email.schema.ts

import {
  VerifyEmailHttpErrors,
  VerifyEmailHttpSuccess,
} from "#presentation/verify-email.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";
import { Type } from "@sinclair/typebox";

export const VerifyEmailQuerySchema = Type.Object({
  token: Type.String({
    minLength: 1,
  }),
});

export const verifyEmailSchema = {
  tags: ["Identity"],

  summary: "Verify email",

  querystring: VerifyEmailQuerySchema,

  response: {
    ...createHttpSuccessResponseSchemas(VerifyEmailHttpSuccess),

    ...createErrorResponseSchemas(VerifyEmailHttpErrors),
  },
};
