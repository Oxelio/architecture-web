// @file apps/api/src/features/iam/activate-user/activate-user.http.ts
import type { ActivateUserError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const ActivateUserHttpContract = {
  success: {
    "user.activated": {
      status: 204,

      description: "User activated successfully",
    },
  },

  errors: {
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
} as const satisfies HttpContract<ActivateUserError["code"], "user.activated">;
