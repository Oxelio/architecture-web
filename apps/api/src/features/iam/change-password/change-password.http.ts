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

      code: "password.empty",

      message: "Password is required",
    },

    "password.too_short": {
      status: 400,

      code: "password.too_short",

      message: "Password is too short",
    },

    "password.too_long": {
      status: 400,
      code: "password.too_long",
      message: "Password is too long",
    },

    "password.confirmation_mismatch": {
      status: 400,
      code: "password.confirmation_mismatch",
      message: "Password confirmation does not match",
    },

    "password.too_common": {
      status: 400,
      code: "password.too_common",
      message: "Password is too common",
    },

    "password.compromised": {
      status: 400,
      code: "password.compromised",
      message: "Password appears in a known data breach",
    },

    "password.contextual": {
      status: 400,
      code: "password.contextual",
      message: "Password contains account information",
    },

    "password.too_weak": {
      status: 400,
      code: "password.too_weak",
      message: "Password does not meet the required strength",
    },

    "password.uppercase_required": {
      status: 400,
      code: "password.uppercase_required",
      message: "Password must contain an uppercase letter",
    },

    "password.lowercase_required": {
      status: 400,
      code: "password.lowercase_required",
      message: "Password must contain a lowercase letter",
    },

    "password.number_required": {
      status: 400,
      code: "password.number_required",
      message: "Password must contain a number",
    },

    "password.special_character_required": {
      status: 400,
      code: "password.special_character_required",
      message: "Password must contain a special character",
    },

    "password.current_invalid": {
      status: 400,
      code: "password.current_invalid",
      message: "Current password is invalid",
    },

    "password.reused": {
      status: 400,
      code: "password.reused",
      message: "New password must differ from the current password",
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
  ChangePasswordError["code"],
  "user.password_changed"
>;
