// @file apps/api/src/schema/identity/suspend-user.schema.ts

import { Type } from "@sinclair/typebox";

import {
  SuspendUserHttpErrors,
  SuspendUserHttpSuccess,
} from "#presentation/suspend-user.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";

export const SuspendUserParamsSchema = Type.Object({
  userId: Type.String({
    format: "uuid",
  }),
});

export const suspendUserSchema = {
  tags: ["Identity"],

  summary: "Suspend user",

  params: SuspendUserParamsSchema,

  response: {
    ...createHttpSuccessResponseSchemas(SuspendUserHttpSuccess),

    ...createErrorResponseSchemas(SuspendUserHttpErrors),
  },
};
