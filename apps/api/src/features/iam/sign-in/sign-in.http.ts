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
    "mfa.invalid_challenge": {
      status: 401,
      code: "mfa.invalid_challenge",
      message: "Invalid MFA challenge",
    },
    "mfa.enrollment_required": {
      status: 403,
      code: "mfa.enrollment_required",
      message: "MFA enrollment required",
    },
    "authentication.invalid_credentials": {
      status: 401,

      code: "authentication.invalid_credentials",

      message: "Invalid credentials",
    },

    "user.suspended": {
      status: 403,

      code: "user.suspended",

      message: "User suspended",
    },
  },
} as const satisfies HttpContract<SignInError["code"], "user.authenticated">;
