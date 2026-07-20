// @file apps/api/src/features/identity/get-user-profile/get-user-profile.presenter.ts

import type { GetUserProfileOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { GetUserProfileHttpContract } from "./get-user-profile.http.js";

const toHttpError = createHttpErrorMapper(GetUserProfileHttpContract.errors);
const toHttpSuccess = createHttpSuccessMapper(
  GetUserProfileHttpContract.success,
);

export const GetUserProfilePresenter = {
  toPresentation(result: GetUserProfileOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
