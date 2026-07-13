// @file apps/api/src/schema/identity/activate-user.schema.ts

import {
  ActivateUserHttpErrors,
  ActivateUserHttpSuccess,
} from "#presentation/activate-user.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";
import { Type } from "@sinclair/typebox";

export const ActivateUserParamsSchema = Type.Object({
  userId: Type.String({
    format: "uuid",
  }),
});

export const activateUserSchema = {
  tags: ["Identity"],

  summary: "Activate user",

  params: ActivateUserParamsSchema,

  response: {
    ...createHttpSuccessResponseSchemas(ActivateUserHttpSuccess),

    ...createErrorResponseSchemas(ActivateUserHttpErrors),
  },
};
