// @file apps/api/src/features/identity/suspend-user/suspend-user.http.ts

import type { SuspendUserError } from "@architecture/identity/application";

import type { HttpContract } from "#types/http.types";

export const SuspendUserHttpContract = {
  success: {
    "user.suspended": {
      status: 200,

      description: "User suspended successfully",
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

    "user.self_administration_forbidden": {
      status: 409,

      code: "SELF_ADMINISTRATION_FORBIDDEN",

      message: "Administrators cannot suspend their own account",
    },
  },
} as const satisfies HttpContract<SuspendUserError["code"], "user.suspended">;
