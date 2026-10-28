import type { AssignUserRoleError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const AssignUserRoleHttpContract = {
  success: {
    "user.role_assigned": {
      status: 204,
      description: "User role assigned successfully",
    },
  },
  errors: {
    LAST_ACTIVE_ADMIN: {
      status: 409,
      code: "LAST_ACTIVE_ADMIN",
      message: "Preserve another valid administrator access path",
    },
    "administrator.unauthorized": {
      status: 403,
      code: "ADMINISTRATOR_UNAUTHORIZED",
      message: "Administrator privileges required",
    },
    "user.invalid_id": {
      status: 400,
      code: "INVALID_USER_ID",
      message: "Invalid user identifier",
    },
    "user_role.empty": {
      status: 400,
      code: "ROLE_REQUIRED",
      message: "Role is required",
    },
    "user_role.invalid": {
      status: 400,
      code: "ROLE_INVALID",
      message: "Invalid user role",
    },
    "user.not_found": {
      status: 404,
      code: "USER_NOT_FOUND",
      message: "User not found",
    },
    "user.self_administration_forbidden": {
      status: 409,
      code: "SELF_ADMINISTRATION_FORBIDDEN",
      message: "Administrators cannot change their own role",
    },
  },
} as const satisfies HttpContract<
  AssignUserRoleError["code"],
  "user.role_assigned"
>;
