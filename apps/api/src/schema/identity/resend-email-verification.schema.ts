// @file apps/api/src/schema/identity/resend-email-verification.schema.ts

import {
  ResendEmailVerificationHttpErrors,
  ResendEmailVerificationHttpSuccess,
} from "#presentation/resend-email-verification.presenter";
import {
  createErrorResponseSchemas,
  createHttpSuccessResponseSchemas,
} from "#schema/http-error-schema";

export const resendEmailVerificationSchema = {
  tags: ["Identity"],

  summary: "Resend email verification",

  response: {
    ...createHttpSuccessResponseSchemas(ResendEmailVerificationHttpSuccess),

    ...createErrorResponseSchemas(ResendEmailVerificationHttpErrors),
  },
};
