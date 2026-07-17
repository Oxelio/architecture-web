// @file apps/api/src/features/identity/resend-email-verification/resend-email-verification.presenter.ts

import type { ResendEmailVerificationResult } from "@architecture/identity/application";

import type {
  HttpErrorDefinitions,
  HttpSuccessDefinitions,
} from "../../../types/http.types.js";
import { createHttpErrorMapper } from "../../../helpers/create-http-error-mapper.js";

export const ResendEmailVerificationHttpErrors = {
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

  "user.email_already_verified": {
    status: 409 as const,
    code: "EMAIL_ALREADY_VERIFIED",
    message: "Email already verified",
  },

  "email_verification.too_many_requests": {
    status: 429 as const,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests",
  },
} satisfies HttpErrorDefinitions<
  | "user.invalid_id"
  | "user.not_found"
  | "user.email_already_verified"
  | "email_verification.too_many_requests"
>;

export const ResendEmailVerificationHttpSuccess = {
  sent: {
    status: 200 as const,
    description: "Email verification sent successfully",
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
} satisfies HttpSuccessDefinitions<"sent">;

const toHttpError = createHttpErrorMapper(ResendEmailVerificationHttpErrors);

export const ResendEmailVerificationPresenter = {
  toPresentation(result: ResendEmailVerificationResult) {
    if (result.success) {
      return {
        status: ResendEmailVerificationHttpSuccess.sent.status,
        body: {
          data: {},
        },
      };
    }

    return toHttpError(result.error);
  },
};
