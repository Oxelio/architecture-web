// @file apps/api/src/features/identity/sign-out/sign-out.http.ts

import type {
  SignOutError,
  SignOutSuccess,
} from "@architecture/identity/application";

import type { HttpContract } from "../../../types/http.types.js";

export const SignOutHttpContract = {
  success: {
    "session.signed_out": {
      status: 204,

      description: "User signed out successfully",
    },
  },

  errors: {
    "session.invalid_id": {
      status: 400,

      code: "INVALID_SESSION_ID",

      message: "Invalid session identifier",
    },
  },
} as const satisfies HttpContract<SignOutError["code"], SignOutSuccess["code"]>;
