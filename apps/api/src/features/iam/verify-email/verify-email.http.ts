// @file apps/api/src/features/iam/verify-email/verify-email.http.ts

import type { VerifyEmailError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const VerifyEmailHttpContract = {
  success: {
    "user.email_verified": {
      status: 204,

      description: "Email verified successfully",
    },
  },

  errors: {
    "email_verification.invalid_token": {
      status: 400,

      code: "email_verification.invalid_token",

      message: "Invalid token",
    },

    "email_verification.expired_token": {
      status: 400,

      code: "email_verification.expired_token",

      message: "Token expired",
    },

    "user.not_found": {
      status: 404,

      code: "user.not_found",

      message: "User not found",
    },
  },
} as const satisfies HttpContract<
  VerifyEmailError["code"],
  "user.email_verified"
>;
