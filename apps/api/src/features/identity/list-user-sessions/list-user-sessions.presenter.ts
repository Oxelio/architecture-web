import type { ListUserSessionsOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { ListUserSessionsHttpContract } from "./list-user-sessions.http.js";

const toHttpError = createHttpErrorMapper(ListUserSessionsHttpContract.errors);

export const ListUserSessionsPresenter = {
  toPresentation(result: ListUserSessionsOutput) {
    if (result.success) {
      return {
        ...ListUserSessionsHttpContract.success["sessions.listed"],
        body: { data: result.value },
      };
    }
    return toHttpError(result.error);
  },
};
