// @file apps/api/src/features/iam/get-current-account/get-current-account.http.ts

import type { GetCurrentAccountError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const GetCurrentAccountHttpContract = {
  success: {
    "account.retrieved": {
      status: 200,

      description: "Current IAM account retrieved successfully",
    },
  },

  errors: {
    "user.invalid_id": {
      status: 400,

      code: "user.invalid_id",

      message: "Invalid user identifier",
    },

    "user.not_found": {
      status: 404,

      code: "user.not_found",

      message: "User not found",
    },
  },
} as const satisfies HttpContract<
  GetCurrentAccountError["code"],
  "account.retrieved"
>;
