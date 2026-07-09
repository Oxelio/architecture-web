import type { ChangeEmailError } from "@architecture/identity/application";
import type { EmptyResponse, HttpError, HttpSuccess } from "./http.types.js";

export const ChangeEmailPresenter = {
  toSuccessHttp(): HttpSuccess<EmptyResponse> {
    return {
      status: 200,
      body: { data: {} },
    };
  },

  toFailureHttp(error: ChangeEmailError): HttpError {
    if (error.kind === "email.empty") {
      return {
        status: 400,
        body: { error: { code: "EMAIL_REQUIRED" } },
      };
    }

    if (error.kind === "email.invalid_format") {
      return {
        status: 400,
        body: { error: { code: "EMAIL_INVALID" } },
      };
    }

    if (error.kind === "email.too_long") {
      return {
        status: 400,
        body: { error: { code: "EMAIL_TOO_LONG" } },
      };
    }

    if (error.kind === "not_found") {
      return {
        status: 404,
        body: { error: { code: "NOT_FOUND" } },
      };
    }

    if (error.kind === "user.already_exists") {
      return {
        status: 409,
        body: { error: { code: "USER_ALREADY_EXISTS" } },
      };
    }

    return {
      status: 500,
      body: { error: { code: "UNKNOWN_ERROR" } },
    };
  },
};
