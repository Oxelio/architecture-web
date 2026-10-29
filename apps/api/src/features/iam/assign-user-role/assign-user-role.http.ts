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
    "administrator.last_active_access": {
      status: 409,
      code: "administrator.last_active_access",
      message: "Preserve another valid administrator access path",
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
    "user_role.empty": {
      status: 400,
      code: "user_role.empty",
      message: "Role is required",
    },
    "user_role.invalid": {
      status: 400,
      code: "user_role.invalid",
      message: "Invalid user role",
    },
    "user.not_found": {
      status: 404,
      code: "user.not_found",
      message: "User not found",
    },
    "user.self_administration_forbidden": {
      status: 409,
      code: "user.self_administration_forbidden",
      message: "Administrators cannot change their own role",
    },
  },
} as const satisfies HttpContract<
  AssignUserRoleError["code"],
  "user.role_assigned"
>;
