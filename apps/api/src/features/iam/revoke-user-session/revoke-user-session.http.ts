import type { RevokeUserSessionError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const RevokeUserSessionHttpContract = {
  success: {
    "session.revoked": {
      status: 204,
      description: "User session(s) revoked successfully",
    },
  },
  errors: {
    "session_management.disabled": {
      status: 403,
      code: "session_management.disabled",
      message: "Session management disabled",
    },
    "administrator.unauthorized": {
      status: 403,
      code: "administrator.unauthorized",
      message: "Administrator privileges required",
    },
    "user.invalid_id": {
      status: 400,
      code: "user.invalid_id",
      message: "Invalid user identifier",
    },
    "session.invalid_id": {
      status: 400,
      code: "session.invalid_id",
      message: "Invalid session identifier",
    },
    "user.not_found": {
      status: 404,
      code: "user.not_found",
      message: "User not found",
    },
    "session.not_found": {
      status: 404,
      code: "session.not_found",
      message: "Session not found for this user",
    },
  },
} as const satisfies HttpContract<
  RevokeUserSessionError["code"],
  "session.revoked"
>;
