// @file apps/api/src/features/identity/change-email/change-email.presenter.ts

import type { ChangeEmailOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";
import { createHttpSuccessMapper } from "../../../helpers/create-http-success-mapper.js";
import { ChangeEmailHttpContract } from "./change-email.http.js";

const toHttpError = createHttpErrorMapper(ChangeEmailHttpContract.errors);

const toHttpSuccess = createHttpSuccessMapper(ChangeEmailHttpContract.success);

export const ChangeEmailPresenter = {
  toPresentation(result: ChangeEmailOutput) {
    if (result.success) {
      return toHttpSuccess(result.value.code);
    }

    return toHttpError(result.error);
  },
};
