// @file apps/api/src/features/iam/resend-email-verification/resend-email-verification.presenter.ts

import type { ResendEmailVerificationOutput } from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { ResendEmailVerificationHttpContract } from "./resend-email-verification.http.js";

const toHttpError = createHttpErrorMapper(
  ResendEmailVerificationHttpContract.errors,
);
export const ResendEmailVerificationPresenter = {
  toPresentation(result: ResendEmailVerificationOutput) {
    if (result.success) {
      return ResendEmailVerificationHttpContract.success[
        "email_verification.sent"
      ];
    }

    return toHttpError(result.error);
  },
};
