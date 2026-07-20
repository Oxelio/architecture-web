// @file apps/api/src/features/identity/sign-in/sign-in.presenter.ts

import type { SignInOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";
import { createHttpSuccessMapper } from "#helpers/create-http-success-mapper";

import { SignInHttpContract } from "./sign-in.http.js";

const toHttpError = createHttpErrorMapper(SignInHttpContract.errors);
const toHttpSuccess = createHttpSuccessMapper(SignInHttpContract.success);

export const SignInPresenter = {
  toPresentation(result: SignInOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
