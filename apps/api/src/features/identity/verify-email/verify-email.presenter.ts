// @file apps/api/src/features/identity/verify-email/verify-email.presenter.ts

import type { VerifyEmailOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { VerifyEmailHttpContract } from "./verify-email.http.js";

const toHttpError = createHttpErrorMapper(VerifyEmailHttpContract.errors);
const toHttpSuccess = createHttpSuccessMapper(VerifyEmailHttpContract.success);

export const VerifyEmailPresenter = {
  toPresentation(result: VerifyEmailOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
