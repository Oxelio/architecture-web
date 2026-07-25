// @file apps/api/src/features/identity/get-user-profile/get-user-profile.presenter.ts

import type { GetUserProfileOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { GetUserProfileHttpContract } from "./get-user-profile.http.js";

const toHttpError = createHttpErrorMapper(GetUserProfileHttpContract.errors);
export const GetUserProfilePresenter = {
  toPresentation(result: GetUserProfileOutput) {
    if (result.success) {
      return GetUserProfileHttpContract.success["user.profile_retrieved"];
    }

    return toHttpError(result.error);
  },
};
