// @file apps/api/src/features/identity/activate-user/activate-user.presenter.ts

import type { ActivateUserOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { ActivateUserHttpContract } from "./activate-user.http.js";

const toHttpError = createHttpErrorMapper(ActivateUserHttpContract.errors);

export const ActivateUserPresenter = {
  toPresentation(result: ActivateUserOutput) {
    if (result.success) {
      return ActivateUserHttpContract.success["user.activated"];
    }

    return toHttpError(result.error);
  },
};
