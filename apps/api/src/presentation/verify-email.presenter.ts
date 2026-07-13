import type {
  VerifyEmailError,
  VerifyEmailResult,
} from "@architecture/identity/application";
import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "./http.types.js";
import { createHttpErrorMapper } from "#schema/http-error-schema";

export const VerifyEmailHttpErrors = {
  "token.invalid": {
    status: 400 as const,
    code: "TOKEN_INVALID",
    message: "Invalid token",
  },

  "token.expired": {
    status: 400 as const,
    code: "TOKEN_EXPIRED",
    message: "Token expired",
  },

  "user.not_found": {
    status: 404 as const,
    code: "USER_NOT_FOUND",
    message: "User not found",
  },
} satisfies HttpErrorDefinitions<VerifyEmailError["code"]>;

export const VerifyEmailHttpSuccess = {
  verified: {
    status: 200 as const,
    description: "Email verified successfully",
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
} satisfies HttpSuccessDefinitions<"verified">;

const toHttpError = createHttpErrorMapper(VerifyEmailHttpErrors);

export const VerifyEmailPresenter = {
  toPresentation(result: VerifyEmailResult) {
    if (result.success) {
      return {
        status: VerifyEmailHttpSuccess.verified.status,
        body: {
          data: {},
        },
      };
    }

    return toHttpError(result.error);
  },
};
