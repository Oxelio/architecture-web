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
    "users.invalid_page": {
      status: 400,
      code: "INVALID_PAGE",
      message: "Page must be a strictly positive integer",
    },
    "users.invalid_page_size": {
      status: 400,
      code: "INVALID_PAGE_SIZE",
      message: "Page size must be between 1 and 100",
    },
    "administrator.unauthorized": {
      status: 403,
      code: "ADMINISTRATOR_UNAUTHORIZED",
      message: "Administrator privileges required",
    },
  },
} as const satisfies HttpContract<ListUsersError["code"], "users.listed">;
