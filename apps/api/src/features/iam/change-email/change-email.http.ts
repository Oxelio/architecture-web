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
    LAST_ACTIVE_ADMIN: {
      status: 409,
      code: "LAST_ACTIVE_ADMIN",
      message: "Preserve another valid administrator access path",
    },
    "feature.disabled": {
      status: 403,

      code: "FEATURE_DISABLED",

      message: "Email change is disabled",
    },

    "email.empty": {
      status: 400,

      code: "EMAIL_REQUIRED",

      message: "Email is required",
    },

    "email.invalid_format": {
      status: 400,

      code: "EMAIL_INVALID",

      message: "Invalid email format",
    },

    "email.too_long": {
      status: 400,

      code: "EMAIL_TOO_LONG",

      message: "Email is too long",
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

    "user.already_exists": {
      status: 409,

      code: "USER_ALREADY_EXISTS",

      message: "User already exists",
    },
  },
} as const satisfies HttpContract<
  ChangeEmailError["code"],
  "user.email_changed"
>;
