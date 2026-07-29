import type { AdministratorAuthorizationError } from "@architecture/iam/application";

import type { HttpContract } from "#types/http.types";

export const GetUserAdministrationOverviewHttpContract = {
  success: {
    "users.overview_retrieved": {
      status: 200,
      description: "User administration overview retrieved successfully",
    },
  },
  errors: {
    "administrator.unauthorized": {
      status: 403,
      code: "ADMINISTRATOR_UNAUTHORIZED",
      message: "Administrator privileges required",
    },
  },
} as const satisfies HttpContract<
  AdministratorAuthorizationError["code"],
  "users.overview_retrieved"
>;
