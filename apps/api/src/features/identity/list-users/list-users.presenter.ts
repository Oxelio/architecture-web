import type { ListUsersOutput } from "@architecture/identity/application";

import { ListUsersHttpContract } from "./list-users.http.js";

export const ListUsersPresenter = {
  toPresentation(result: ListUsersOutput) {
    if (!result.success) {
      throw new Error("ListUsers cannot fail");
    }

    return {
      ...ListUsersHttpContract.success["users.listed"],
      body: { data: result.value },
    };
  },
};
