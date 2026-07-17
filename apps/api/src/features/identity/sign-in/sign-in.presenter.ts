// @file apps/api/src/features/identity/sign-in/sign-in.presenter.ts

import type {
  SignInError,
  SignInResult,
} from "@architecture/identity/application";
import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "../../../types/http.types.js";
import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";

export const SignInHttpErrors = {
  "user.invalid_credentials": {
    status: 401 as const,
    code: "INVALID_CREDENTIALS",
    message: "Invalid credentials",
  },

  "user.suspended": {
    status: 403 as const,
    code: "USER_SUSPENDED",
    message: "User suspended",
  },
} satisfies HttpErrorDefinitions<SignInError["code"]>;

export const SignInHttpSuccess = {
  authenticated: {
    status: 200 as const,
    description: "User authenticated successfully",
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
} satisfies HttpSuccessDefinitions<"authenticated">;

const toHttpError = createHttpErrorMapper(SignInHttpErrors);

export const SignInPresenter = {
  toPresentation(result: SignInResult) {
    if (result.success) {
      return {
        status: SignInHttpSuccess.authenticated.status,
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
