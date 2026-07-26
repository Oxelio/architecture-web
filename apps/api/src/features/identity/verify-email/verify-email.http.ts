// @file apps/api/src/features/identity/verify-email/verify-email.http.ts

import type { VerifyEmailError } from "@architecture/identity/application";

import type { HttpContract } from "#types/http.types";

export const VerifyEmailHttpContract = {
  success: {
    "user.email_verified": {
      status: 200,

      description: "Email verified successfully",
    },
  },

  errors: {
    "token.invalid": {
      status: 400,

      code: "TOKEN_INVALID",

      message: "Invalid token",
    },

    "token.expired": {
      status: 400,

      code: "TOKEN_EXPIRED",

      message: "Token expired",
    },

    "user.not_found": {
      status: 404,

      code: "USER_NOT_FOUND",

      message: "User not found",
    },
  },
} as const satisfies HttpContract<
  VerifyEmailError["code"],
  "user.email_verified"
>;
