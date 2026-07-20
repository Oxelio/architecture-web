// @file apps/api/src/features/identity/sign-out/sign-out.presenter.ts

import type { SignOutOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { SignOutHttpContract } from "./sign-out.http.js";

const toHttpError = createHttpErrorMapper(SignOutHttpContract.errors);
const toHttpSuccess = createHttpSuccessMapper(SignOutHttpContract.success);

export const SignOutPresenter = {
  toPresentation(result: SignOutOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
