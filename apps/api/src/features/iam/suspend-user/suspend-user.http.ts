// @file apps/api/src/features/iam/suspend-user/suspend-user.http.ts

import type { SuspendUserError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const SuspendUserHttpContract = {
  success: {
    "user.suspended": {
      status: 204,

      description: "User suspended successfully",
    },
  },

  errors: {
    "administrator.last_active_access": {
      status: 409,
      code: "administrator.last_active_access",
      message: "Preserve another valid administrator access path",
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

    "user.self_administration_forbidden": {
      status: 409,

      code: "user.self_administration_forbidden",

      message: "Administrators cannot suspend their own account",
    },
  },
} as const satisfies HttpContract<SuspendUserError["code"], "user.suspended">;
