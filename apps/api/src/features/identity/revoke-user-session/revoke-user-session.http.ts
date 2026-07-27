import type { RevokeUserSessionError } from "@architecture/identity/application";

import type { HttpContract } from "#types/http.types";

export const RevokeUserSessionHttpContract = {
  success: {
    "session.revoked": {
      status: 204,
      description: "User session(s) revoked successfully",
    },
  },
  errors: {
    "user.invalid_id": {
      status: 400,
      code: "INVALID_USER_ID",
      message: "Invalid user identifier",
    },
    "session.invalid_id": {
      status: 400,
      code: "INVALID_SESSION_ID",
      message: "Invalid session identifier",
    },
    "user.not_found": {
      status: 404,
      code: "USER_NOT_FOUND",
      message: "User not found",
    },
    "session.not_found": {
      status: 404,
      code: "SESSION_NOT_FOUND",
      message: "Session not found for this user",
    },
  },
} as const satisfies HttpContract<
  RevokeUserSessionError["code"],
  "session.revoked"
>;
