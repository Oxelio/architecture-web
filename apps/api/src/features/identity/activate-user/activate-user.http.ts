// @file apps/api/src/features/identity/activate-user/activate-user.http.ts
import type { ActivateUserError } from "@architecture/identity/application";

import type { HttpContract } from "#types/http.types";

export const ActivateUserHttpContract = {
  success: {
    "user.activated": {
      status: 204,

      description: "User activated successfully",
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
} as const satisfies HttpContract<ActivateUserError["code"], "user.activated">;
