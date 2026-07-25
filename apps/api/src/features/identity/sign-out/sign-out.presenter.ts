// @file apps/api/src/features/identity/sign-out/sign-out.presenter.ts

import type { SignOutOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { SignOutHttpContract } from "./sign-out.http.js";

const toHttpError = createHttpErrorMapper(SignOutHttpContract.errors);
export const SignOutPresenter = {
  toPresentation(result: SignOutOutput) {
    if (result.success) {
      return SignOutHttpContract.success["session.signed_out"];
    }

    return toHttpError(result.error);
  },
};
