// @file apps/api/src/features/identity/change-email/change-email.presenter.ts

import type { ChangeEmailOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { ChangeEmailHttpContract } from "./change-email.http.js";

const toHttpError = createHttpErrorMapper(ChangeEmailHttpContract.errors);

export const ChangeEmailPresenter = {
  toPresentation(result: ChangeEmailOutput) {
    if (result.success) {
      return ChangeEmailHttpContract.success["user.email_changed"];
    }

    return toHttpError(result.error);
  },
};
