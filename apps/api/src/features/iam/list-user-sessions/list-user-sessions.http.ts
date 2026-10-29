import type { ListUserSessionsError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const ListUserSessionsHttpContract = {
  success: {
    "sessions.listed": {
      status: 200,
      description: "User sessions retrieved successfully",
    },
  },
  errors: {
    "session_management.disabled": {
      status: 403,
      code: "session_management.disabled",
      message: "Session management disabled",
    },
    "administrator.unauthorized": {
      status: 403,
      code: "administrator.unauthorized",
      message: "Administrator privileges required",
    },
    "user.invalid_id": {
      status: 400,
      code: "user.invalid_id",
      message: "Invalid user identifier",
    },
    "user.not_found": {
      status: 404,
      code: "user.not_found",
      message: "User not found",
    },
  },
} as const satisfies HttpContract<
  ListUserSessionsError["code"],
  "sessions.listed"
>;
