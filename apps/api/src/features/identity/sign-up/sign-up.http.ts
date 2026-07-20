// @file apps/api/src/features/identity/sign-up/sign-up.http.ts

import type {
  SignUpError,
  SignUpSuccess,
} from "@architecture/identity/application";

import type { HttpContract } from "../../../types/http.types.js";

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

    "user.already_exists": {
      status: 409,

      code: "USER_ALREADY_EXISTS",

      message: "User already exists",
    },
  },
} as const satisfies HttpContract<SignUpError["code"], SignUpSuccess["code"]>;
