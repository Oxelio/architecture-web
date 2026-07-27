import type { HttpContract } from "#types/http.types";

export const ListUsersHttpContract = {
  success: {
    "users.listed": {
      status: 200,
      description: "Users retrieved successfully",
    },
  },
  errors: {},
} as const satisfies HttpContract<never, "users.listed">;
