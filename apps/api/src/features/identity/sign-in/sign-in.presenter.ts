// @file apps/api/src/features/identity/sign-in/sign-in.presenter.ts

import type { SignInOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { SignInHttpContract } from "./sign-in.http.js";

const toHttpError = createHttpErrorMapper(SignInHttpContract.errors);
export const SignInPresenter = {
  toPresentation(result: SignInOutput) {
    if (result.success) {
      return SignInHttpContract.success["user.authenticated"];
    }

    return toHttpError(result.error);
  },
};
