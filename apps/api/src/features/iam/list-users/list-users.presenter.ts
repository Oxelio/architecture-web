import type { ListUsersOutput } from "@architecture/iam/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { ListUsersHttpContract } from "./list-users.http.js";

const toHttpError = createHttpErrorMapper(ListUsersHttpContract.errors);

export const ListUsersPresenter = {
  toPresentation(result: ListUsersOutput) {
    if (!result.success) {
      return toHttpError(result.error);
    }

    return {
      ...ListUsersHttpContract.success["users.listed"],
      body: { data: result.value },
    };
  },
};
