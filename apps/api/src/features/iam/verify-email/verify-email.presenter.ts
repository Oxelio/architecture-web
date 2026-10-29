// @file apps/api/src/features/iam/verify-email/verify-email.presenter.ts

import type { VerifyEmailOutput } from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { VerifyEmailHttpContract } from "./verify-email.http.js";

const toHttpError = createHttpErrorMapper(VerifyEmailHttpContract.errors);
export const VerifyEmailPresenter = {
  toPresentation(result: VerifyEmailOutput) {
    if (result.success) {
      return VerifyEmailHttpContract.success["user.email_verified"];
    }

    return toHttpError(result.error);
  },
};
