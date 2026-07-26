// @file apps/api/src/features/identity/change-password/change-password.http.ts

import type { ChangePasswordError } from "@architecture/identity/application";

import type { HttpContract } from "#types/http.types";

export const ChangePasswordHttpContract = {
  success: {
    "user.password_changed": {
      status: 200,

      description: "Password changed successfully",
    },
  },

  errors: {
    "password.empty": {
      status: 400,

      code: "PASSWORD_REQUIRED",

      message: "Password is required",
    },

    "password.too_short": {
      status: 400,

      code: "PASSWORD_TOO_SHORT",

      message: "Password is too short",
    },

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
  ChangePasswordError["code"],
  "user.password_changed"
>;
