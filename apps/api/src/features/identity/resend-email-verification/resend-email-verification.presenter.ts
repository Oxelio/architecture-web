// @file apps/api/src/features/identity/resend-email-verification/resend-email-verification.presenter.ts

import type { ResendEmailVerificationOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { ResendEmailVerificationHttpContract } from "./resend-email-verification.http.js";

const toHttpError = createHttpErrorMapper(
  ResendEmailVerificationHttpContract.errors,
);
const toHttpSuccess = createHttpSuccessMapper(
  ResendEmailVerificationHttpContract.success,
);

export const ResendEmailVerificationPresenter = {
  toPresentation(result: ResendEmailVerificationOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
