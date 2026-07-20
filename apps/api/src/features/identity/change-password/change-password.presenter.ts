// @file apps/api/src/features/identity/change-password/change-password.presenter.ts

import type { ChangePasswordOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { ChangePasswordHttpContract } from "./change-password.http.js";

const toHttpError = createHttpErrorMapper(ChangePasswordHttpContract.errors);
const toHttpSuccess = createHttpSuccessMapper(
  ChangePasswordHttpContract.success,
);

export const ChangePasswordPresenter = {
  toPresentation(result: ChangePasswordOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
