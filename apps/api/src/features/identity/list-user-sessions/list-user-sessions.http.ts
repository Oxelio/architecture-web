import type { ListUserSessionsError } from "@architecture/identity/application";

import type { HttpContract } from "#types/http.types";

export const ListUserSessionsHttpContract = {
  success: {
    "sessions.listed": {
      status: 200,
      description: "User sessions retrieved successfully",
    },
  },
  errors: {
    "user.invalid_id": {
      status: 400,
      code: "INVALID_USER_ID",
      message: "Invalid user identifier",
    },
    "user.not_found": {
      status: 404,
      code: "USER_NOT_FOUND",
      message: "User not found",
    },
  },
} as const satisfies HttpContract<
  ListUserSessionsError["code"],
  "sessions.listed"
>;
