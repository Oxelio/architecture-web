// @file apps/api/src/features/iam/sign-up/sign-up.http.ts

import type { SignUpError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const SignUpHttpContract = {
  success: {
    "user.created": {
      status: 201,

      description: "User created successfully",
    },
  },

  errors: {
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

    "user.already_exists": {
      status: 409,

      code: "USER_ALREADY_EXISTS",

      message: "User already exists",
    },
  },
} as const satisfies HttpContract<SignUpError["code"], "user.created">;
