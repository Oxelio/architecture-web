import type {
  ChangeEmailError,
  ChangeEmailResult,
} from "@architecture/identity/application";
import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "./http.types.js";
import { createHttpErrorMapper } from "#schema/http-error-schema";

export const ChangeEmailHttpErrors = {
  "email.empty": {
    status: 400,
    code: "EMAIL_REQUIRED",
    message: "Email is required",
  },

  "email.invalid_format": {
    status: 400,
    code: "EMAIL_INVALID",
    message: "Invalid email format",
  },

  "email.too_long": {
    status: 400,
    code: "EMAIL_TOO_LONG",
    message: "Email is too long",
  },

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

  "user.already_exists": {
    status: 409,
    code: "USER_ALREADY_EXISTS",
    message: "User already exists",
  },
} satisfies HttpErrorDefinitions<ChangeEmailError["code"]>;

export const ChangeEmailHttpSuccess = {
  changed: {
    status: 200,
    description: "Email changed successfully",
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

const toHttpError = createHttpErrorMapper(ChangeEmailHttpErrors);

export const ChangeEmailPresenter = {
  toPresentation(result: ChangeEmailResult) {
    if (result.success) {
      return {
        status: ChangeEmailHttpSuccess.changed.status,
        body: {
          data: {},
        },
      };
    }

    return toHttpError(result.error);
  },
};
