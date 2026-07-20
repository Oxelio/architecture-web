// @file apps/api/src/features/identity/activate-user/activate-user.presenter.ts

import type { ActivateUserOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { ActivateUserHttpContract } from "./activate-user.http.js";

const toHttpError = createHttpErrorMapper(ActivateUserHttpContract.errors);

const toHttpSuccess = createHttpSuccessMapper(ActivateUserHttpContract.success);

export const ActivateUserPresenter = {
  toPresentation(result: ActivateUserOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
