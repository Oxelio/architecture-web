// @file apps/api/src/features/iam/get-current-account/get-current-account.presenter.ts

import type { GetCurrentAccountOutput } from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { GetCurrentAccountHttpContract } from "./get-current-account.http.js";

const toHttpError = createHttpErrorMapper(GetCurrentAccountHttpContract.errors);
export const GetCurrentAccountPresenter = {
  toPresentation(result: GetCurrentAccountOutput) {
    if (result.success) {
      return {
        ...GetCurrentAccountHttpContract.success["account.retrieved"],
        body: {
          data: result.value,
        },
      };
    }

    return toHttpError(result.error);
  },
};
