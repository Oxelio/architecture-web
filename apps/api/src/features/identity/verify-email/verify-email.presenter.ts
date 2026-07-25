// @file apps/api/src/features/identity/verify-email/verify-email.presenter.ts

import type { VerifyEmailOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
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
