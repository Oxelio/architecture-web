// @file apps/api/src/features/iam/change-email/change-email.http.ts
import type { ChangeEmailError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const ChangeEmailHttpContract = {
  success: {
    "user.email_changed": {
      status: 204,

      description: "Email changed successfully",
    },
  },

  errors: {
    "administrator.last_active_access": {
      status: 409,
      code: "administrator.last_active_access",
      message: "Preserve another valid administrator access path",
    },
    "email_change.disabled": {
      status: 403,

      code: "email_change.disabled",

      message: "Email change is disabled",
    },

    "email.empty": {
      status: 400,

      code: "email.empty",

      message: "Email is required",
    },

    "email.invalid_format": {
      status: 400,

      code: "email.invalid_format",

      message: "Invalid email format",
    },

    "email.too_long": {
      status: 400,

      code: "email.too_long",

      message: "Email is too long",
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

    "user.already_exists": {
      status: 409,

      code: "user.already_exists",

      message: "User already exists",
    },
  },
} as const satisfies HttpContract<
  ChangeEmailError["code"],
  "user.email_changed"
>;
