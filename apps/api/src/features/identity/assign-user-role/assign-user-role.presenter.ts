import type { AssignUserRoleOutput } from "@architecture/identity/application";

import { createHttpErrorMapper } from "#helpers/create-http-error-mapper";

import { AssignUserRoleHttpContract } from "./assign-user-role.http.js";

const toHttpError = createHttpErrorMapper(AssignUserRoleHttpContract.errors);

export const AssignUserRolePresenter = {
  toPresentation(result: AssignUserRoleOutput) {
    if (result.success) {
      return AssignUserRoleHttpContract.success["user.role_assigned"];
    }

    return toHttpError(result.error);
  },
};
