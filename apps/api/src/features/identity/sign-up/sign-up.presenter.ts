// @file apps/api/src/features/identity/sign-up/sign-up.presenter.ts

import type { SignUpOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { SignUpHttpContract } from "./sign-up.http.js";

const toHttpError = createHttpErrorMapper(SignUpHttpContract.errors);
const toHttpSuccess = createHttpSuccessMapper(SignUpHttpContract.success);

export const SignUpPresenter = {
  toPresentation(result: SignUpOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
