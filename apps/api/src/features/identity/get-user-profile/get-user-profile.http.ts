// @file apps/api/src/features/identity/get-user-profile/get-user-profile.http.ts

import type {
  GetUserProfileError,
  GetUserProfileSuccess,
} from "@architecture/identity/application";

import type { HttpContract } from "../../../types/http.types.js";

export const GetUserProfileHttpContract = {
  success: {
    "user.profile_retrieved": {
      status: 200,

      description: "User profile retrieved successfully",
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
  },
} as const satisfies HttpContract<
  GetUserProfileError["code"],
  GetUserProfileSuccess["code"]
>;
