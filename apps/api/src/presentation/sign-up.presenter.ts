// @file apps/api/src/presentation/sign-up.presenter.ts

import type {
  SignUpError,
  SignUpResult,
} from "@architecture/identity/application";

import { createHttpErrorMapper } from "#schema/http-error-schema";

import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "./http.types.js";

export const SignUpHttpErrors = {
  "email.empty": {
    status: 400 as const,
    code: "EMAIL_REQUIRED",
    message: "Email is required",
  },

  "email.invalid_format": {
    status: 400 as const,
    code: "EMAIL_INVALID",
    message: "Invalid email format",
  },

  "email.too_long": {
    status: 400 as const,
    code: "EMAIL_TOO_LONG",
    message: "Email is too long",
  },

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

  "user.already_exists": {
    status: 409 as const,
    code: "USER_ALREADY_EXISTS",
    message: "User already exists",
  },
} satisfies HttpErrorDefinitions<SignUpError["code"]>;

export const SignUpHttpSuccess = {
  created: {
    status: 201 as const,
    description: "User created successfully",
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
          },
          required: ["userId"],
        },
      },
      required: ["data"],
    },
  },
} satisfies HttpSuccessDefinitions<"created">;

const toHttpError = createHttpErrorMapper(SignUpHttpErrors);

export const SignUpPresenter = {
  toPresentation(result: SignUpResult) {
    if (result.success) {
      return {
        status: SignUpHttpSuccess.created.status,
        body: {
          data: {
            userId: result.value.userId,
          },
        },
      };
    }

    return toHttpError(result.error);
  },
};
