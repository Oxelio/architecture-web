// @file apps/api/src/features/iam/suspend-user/suspend-user.presenter.ts

import type { SuspendUserOutput } from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { SuspendUserHttpContract } from "./suspend-user.http.js";

const toHttpError = createHttpErrorMapper(SuspendUserHttpContract.errors);
export const SuspendUserPresenter = {
  toPresentation(result: SuspendUserOutput) {
    if (result.success) {
      return SuspendUserHttpContract.success["user.suspended"];
    }

    return toHttpError(result.error);
  },
};
