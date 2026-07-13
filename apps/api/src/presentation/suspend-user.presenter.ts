// @file apps/api/src/presentation/suspend-user.presenter.ts

import type { SuspendUserResult } from "@architecture/identity/application";

import { createHttpErrorMapper } from "#schema/http-error-schema";

import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "./http.types.js";

export const SuspendUserHttpErrors = {
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

export const SuspendUserHttpSuccess = {
  suspended: {
    status: 200 as const,
    description: "User suspended successfully",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {},
        },
      },
      required: ["data"],
    },
  },
} satisfies HttpSuccessDefinitions<"suspended">;

const toHttpError = createHttpErrorMapper(SuspendUserHttpErrors);

export const SuspendUserPresenter = {
  toPresentation(result: SuspendUserResult) {
    if (result.success) {
      return {
        status: SuspendUserHttpSuccess.suspended.status,
        body: {
          data: {},
        },
      };
    }

    return toHttpError(result.error);
  },
};
