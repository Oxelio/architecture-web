// @file apps/api/src/presentation/change-password.presenter.ts

import type {
  ChangePasswordError,
  ChangePasswordResult,
} from "@architecture/identity/application";

import { createHttpErrorMapper } from "#schema/http-error-schema";

import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "./http.types.js";

export const ChangePasswordHttpErrors = {
  "password.empty": {
    status: 400 as const,
    code: "PASSWORD_REQUIRED",
    message: "Password is required",
  },

  "password.too_short": {
    status: 400 as const,
    code: "PASSWORD_TOO_SHORT",
    message: "Password is too short",
  },

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
} satisfies HttpErrorDefinitions<ChangePasswordError["code"]>;

export const ChangePasswordHttpSuccess = {
  changed: {
    status: 200 as const,
    description: "Password changed successfully",
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
} satisfies HttpSuccessDefinitions<"changed">;

const toHttpError = createHttpErrorMapper(ChangePasswordHttpErrors);

export const ChangePasswordPresenter = {
  toPresentation(result: ChangePasswordResult) {
    if (result.success) {
      return {
        status: ChangePasswordHttpSuccess.changed.status,
        body: {
          data: {},
        },
      };
    }

    return toHttpError(result.error);
  },
};
