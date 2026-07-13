import {
  ChangeEmailHttpErrors,
  ChangeEmailHttpSuccess,
} from "#presentation/change-email.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";
import { Type } from "@sinclair/typebox";

export const ChangeEmailBodySchema = Type.Object({
  email: Type.String({
    format: "email",
  }),
});

export const changeEmailSchema = {
  tags: ["Identity"],

  summary: "Change email",

  body: ChangeEmailBodySchema,

  response: {
    ...createHttpSuccessResponseSchemas(ChangeEmailHttpSuccess),

    ...createErrorResponseSchemas(ChangeEmailHttpErrors),
  },
};
