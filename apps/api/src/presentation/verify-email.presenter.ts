import type { VerifyEmailError } from "@architecture/identity/application";
import type { EmptyResponse, HttpError, HttpSuccess } from "./http.types.js";

export const VerifyEmailPresenter = {
  toSuccessHttp(): HttpSuccess<EmptyResponse> {
    return {
      status: 200,
      body: { data: {} },
    };
  },

  toFailureHttp(error: VerifyEmailError): HttpError {
    switch (error.code) {
      case "token.invalid":
        return {
          status: 400,
          body: { error: { code: "TOKEN_INVALID" } },
        };
      case "token.expired":
        return {
          status: 400,
          body: { error: { code: "TOKEN_EXPIRED" } },
        };
      case "user.not_found":
        return {
          status: 404,
          body: { error: { code: "NOT_FOUND" } },
        };
      default:
        return {
          status: 500,
          body: { error: { code: "UNKNOWN_ERROR" } },
        };
    }
  },
};
