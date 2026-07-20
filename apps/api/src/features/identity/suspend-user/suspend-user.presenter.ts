// @file apps/api/src/features/identity/suspend-user/suspend-user.presenter.ts

import type { SuspendUserOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { SuspendUserHttpContract } from "./suspend-user.http.js";

const toHttpError = createHttpErrorMapper(SuspendUserHttpContract.errors);
const toHttpSuccess = createHttpSuccessMapper(SuspendUserHttpContract.success);

export const SuspendUserPresenter = {
  toPresentation(result: SuspendUserOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
