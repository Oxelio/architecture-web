// @file apps/api/src/features/identity/suspend-user/suspend-user.http.ts

import type {
  SuspendUserError,
  SuspendUserSuccess,
} from "@architecture/identity/application";

import type { HttpContract } from "../../../types/http.types.js";

export const SuspendUserHttpContract = {
  success: {
    "user.suspended": {
      status: 200,

      description: "User suspended successfully",
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
  SuspendUserError["code"],
  SuspendUserSuccess["code"]
>;
