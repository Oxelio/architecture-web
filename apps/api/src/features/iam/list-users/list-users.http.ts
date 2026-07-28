import type { ListUsersError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const ListUsersHttpContract = {
  success: {
    "users.listed": {
      status: 200,
      description: "Users retrieved successfully",
    },
  },
  errors: {
    "administrator.unauthorized": {
      status: 403,
      code: "ADMINISTRATOR_UNAUTHORIZED",
      message: "Administrator privileges required",
    },
  },
} as const satisfies HttpContract<ListUsersError["code"], "users.listed">;
