import type { GetUserProfileResult } from "@architecture/identity/application";
import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "./http.types.js";
import { createHttpErrorMapper } from "#schema/http-error-schema";

export const GetUserProfileHttpErrors = {
  "user.invalid_id": {
    status: 400 as const,
    code: "INVALID_USER_ID",
    message: "Invalid user identifier",
  },

  "user.not_found": {
    status: 404 as const,
    code: "USER_NOT_FOUND",
    message: "User not found",
  },
} satisfies HttpErrorDefinitions<"user.invalid_id" | "user.not_found">;

export const GetUserProfileHttpSuccess = {
  retrieved: {
    status: 200 as const,
    description: "User profile retrieved successfully",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              format: "uuid",
            },
            email: {
              type: "string",
              format: "email",
            },
            isEmailVerified: {
              type: "boolean",
            },
          },
          required: ["userId", "email", "isEmailVerified"],
        },
      },
      required: ["data"],
    },
  },
} satisfies HttpSuccessDefinitions<"retrieved">;

const toHttpError = createHttpErrorMapper(GetUserProfileHttpErrors);

export const GetUserProfilePresenter = {
  toPresentation(result: GetUserProfileResult) {
    if (result.success) {
      return {
        status: GetUserProfileHttpSuccess.retrieved.status,
        body: {
          data: {
            userId: result.value.userId,
            email: result.value.email,
            isEmailVerified: result.value.isEmailVerified,
          },
        },
      };
    }

    return toHttpError(result.error);
  },
};
