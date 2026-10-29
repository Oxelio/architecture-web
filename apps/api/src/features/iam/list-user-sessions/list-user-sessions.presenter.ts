import type {
  ListCurrentUserSessionsOutput,
  ListUserSessionsOutput,
} from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";
import type { ControllerResponse } from "#types/controller-response";

import { ListUserSessionsHttpContract } from "./list-user-sessions.http.js";

const toHttpError = createHttpErrorMapper(ListUserSessionsHttpContract.errors);

export const ListUserSessionsPresenter = {
  toPresentation(
    result: ListUserSessionsOutput | ListCurrentUserSessionsOutput,
  ): ControllerResponse {
    if (result.success) {
      return {
        ...ListUserSessionsHttpContract.success["sessions.listed"],
        body: { data: result.value },
      };
    }
    return toHttpError(result.error);
  },
};
