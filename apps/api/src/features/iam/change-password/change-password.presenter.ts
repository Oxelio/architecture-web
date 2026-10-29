// @file apps/api/src/features/iam/change-password/change-password.presenter.ts

import type { ChangePasswordOutput } from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { ChangePasswordHttpContract } from "./change-password.http.js";

const toHttpError = createHttpErrorMapper(ChangePasswordHttpContract.errors);
export const ChangePasswordPresenter = {
  toPresentation(result: ChangePasswordOutput) {
    if (result.success) {
      return ChangePasswordHttpContract.success["user.password_changed"];
    }

    return toHttpError(result.error);
  },
};
