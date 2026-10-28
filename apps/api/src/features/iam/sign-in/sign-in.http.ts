// @file apps/api/src/features/iam/sign-in/sign-in.http.ts

import type { SignInError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const SignInHttpContract = {
  success: {
    "user.authenticated": {
      status: 204,

      description: "User authenticated successfully",
    },
  },

  errors: {
    MFA_CHALLENGE_INVALID: {
      status: 401,
      code: "MFA_CHALLENGE_INVALID",
      message: "Invalid MFA challenge",
    },
    MFA_ENROLLMENT_REQUIRED: {
      status: 403,
      code: "MFA_ENROLLMENT_REQUIRED",
      message: "MFA enrollment required",
    },
    "user.invalid_credentials": {
      status: 401,

      code: "INVALID_CREDENTIALS",

      message: "Invalid credentials",
    },

    "user.suspended": {
      status: 403,

      code: "USER_SUSPENDED",

      message: "User suspended",
    },
  },
} as const satisfies HttpContract<SignInError["code"], "user.authenticated">;
