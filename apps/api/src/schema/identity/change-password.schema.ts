// @file apps/api/src/schema/identity/change-password.schema.ts

import {
  ChangePasswordHttpErrors,
  ChangePasswordHttpSuccess,
} from "#presentation/change-password.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";
import { Type } from "@sinclair/typebox";

export const ChangePasswordBodySchema = Type.Object({
  password: Type.String({
    minLength: 8,
  }),
});

export const changePasswordSchema = {
  tags: ["Identity"],

  summary: "Change password",

  body: ChangePasswordBodySchema,

  response: {
    ...createHttpSuccessResponseSchemas(ChangePasswordHttpSuccess),

    ...createErrorResponseSchemas(ChangePasswordHttpErrors),
  },
};
