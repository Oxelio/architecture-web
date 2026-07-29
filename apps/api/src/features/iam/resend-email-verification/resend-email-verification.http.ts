// @file apps/api/src/features/iam/resend-email-verification/resend-email-verification.http.ts

import type { ResendEmailVerificationError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const ResendEmailVerificationHttpContract = {
  success: {
    "email_verification.sent": {
      status: 204,

      description: "Email verification sent successfully",
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

    "user.email_already_verified": {
      status: 409,

      code: "EMAIL_ALREADY_VERIFIED",

      message: "Email already verified",
    },

    "email_verification.too_many_requests": {
      status: 429,

      code: "TOO_MANY_REQUESTS",

      message: "Too many requests",
    },
  },
} as const satisfies HttpContract<
  ResendEmailVerificationError["code"],
  "email_verification.sent"
>;
