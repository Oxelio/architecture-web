// @file apps/api/src/features/identity/sign-in/sign-in.http.ts

import type { SignInError } from "@architecture/identity/application";

import type { HttpContract } from "#types/http.types";

export const SignInHttpContract = {
  success: {
    "user.authenticated": {
      status: 200,

      description: "User authenticated successfully",
    },
  },

  errors: {
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
