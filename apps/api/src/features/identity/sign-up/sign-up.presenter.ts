// @file apps/api/src/features/identity/sign-up/sign-up.presenter.ts

import type { SignUpOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { SignUpHttpContract } from "./sign-up.http.js";

const toHttpError = createHttpErrorMapper(SignUpHttpContract.errors);
export const SignUpPresenter = {
  toPresentation(result: SignUpOutput) {
    if (result.success) {
      return SignUpHttpContract.success["user.created"];
    }

    return toHttpError(result.error);
  },
};
