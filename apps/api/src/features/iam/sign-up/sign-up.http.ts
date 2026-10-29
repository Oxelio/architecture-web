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
    "login_identifier.empty": {
      status: 400,

      code: "login_identifier.empty",

      message: "Login identifier is required",
    },

    "login_identifier.invalid_email": {
      status: 400,

      code: "login_identifier.invalid_email",

      message: "Invalid email format",
    },

    "login_identifier.invalid_username": {
      status: 400,

      code: "login_identifier.invalid_username",

      message: "Invalid username",
    },

    "login_identifier.invalid_kind": {
      status: 400,
      code: "login_identifier.invalid_kind",
      message: "Unknown login identifier kind",
    },
    "login_identifier.not_allowed": {
      status: 400,
      code: "login_identifier.not_allowed",
      message: "Login identifier kind is not allowed",
    },
    "registration.disabled": {
      status: 403,
      code: "registration.disabled",
      message: "Registration is disabled",
    },
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

    "user.already_exists": {
      status: 409,

      code: "user.already_exists",

      message: "User already exists",
    },
  },
} as const satisfies HttpContract<SignUpError["code"], "user.created">;
