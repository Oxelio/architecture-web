// @file apps/api/src/features/iam/change-password/change-password.http.ts

import type { ChangePasswordError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const ChangePasswordHttpContract = {
  success: {
    "user.password_changed": {
      status: 204,

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

    "password.too_long": {
      status: 400,
      code: "PASSWORD_TOO_LONG",
      message: "Password is too long",
    },

    "password.confirmation_mismatch": {
      status: 400,
      code: "PASSWORD_CONFIRMATION_MISMATCH",
      message: "Password confirmation does not match",
    },

    "password.too_common": {
      status: 400,
      code: "PASSWORD_TOO_COMMON",
      message: "Password is too common",
    },

    "password.compromised": {
      status: 400,
      code: "PASSWORD_COMPROMISED",
      message: "Password appears in a known data breach",
    },

    "password.contextual": {
      status: 400,
      code: "PASSWORD_CONTEXTUAL",
      message: "Password contains account information",
    },

    "password.too_weak": {
      status: 400,
      code: "PASSWORD_TOO_WEAK",
      message: "Password does not meet the required strength",
    },

    "password.uppercase_required": {
      status: 400,
      code: "PASSWORD_UPPERCASE_REQUIRED",
      message: "Password must contain an uppercase letter",
    },

    "password.lowercase_required": {
      status: 400,
      code: "PASSWORD_LOWERCASE_REQUIRED",
      message: "Password must contain a lowercase letter",
    },

    "password.number_required": {
      status: 400,
      code: "PASSWORD_NUMBER_REQUIRED",
      message: "Password must contain a number",
    },

    "password.special_character_required": {
      status: 400,
      code: "PASSWORD_SPECIAL_CHARACTER_REQUIRED",
      message: "Password must contain a special character",
    },

    "password.current_invalid": {
      status: 400,
      code: "PASSWORD_CURRENT_INVALID",
      message: "Current password is invalid",
    },

    "password.reused": {
      status: 400,
      code: "PASSWORD_REUSED",
      message: "New password must differ from the current password",
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
