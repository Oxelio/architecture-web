// @file apps/api/src/features/identity/change-password/change-password.presenter.ts

import type { ChangePasswordOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
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
