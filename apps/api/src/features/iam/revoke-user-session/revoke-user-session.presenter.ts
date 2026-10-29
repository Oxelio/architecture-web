import type {
  RevokeCurrentUserSessionOutput,
  RevokeUserSessionOutput,
} from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { RevokeUserSessionHttpContract } from "./revoke-user-session.http.js";

const toHttpError = createHttpErrorMapper(RevokeUserSessionHttpContract.errors);

export const RevokeUserSessionPresenter = {
  toPresentation(
    result: RevokeUserSessionOutput | RevokeCurrentUserSessionOutput,
  ) {
    return result.success
      ? RevokeUserSessionHttpContract.success["session.revoked"]
      : toHttpError(result.error);
  },
};
