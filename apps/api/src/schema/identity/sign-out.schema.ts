// @file apps/api/src/schema/identity/sign-out.schema.ts

import {
  SignOutHttpErrors,
  SignOutHttpSuccess,
} from "#presentation/sign-out.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";

export const signOutSchema = {
  tags: ["Identity"],

  summary: "Sign out",

  response: {
    ...createHttpSuccessResponseSchemas(SignOutHttpSuccess),

    ...createErrorResponseSchemas(SignOutHttpErrors),
  },
};
