import type { VerifyEmailError } from "@architecture/identity/application";
import type { HttpError } from "./http-error.js";
import type { HttpSuccess } from "./http-success.js";

export const VerifyEmailPresenter = {
  toSuccessHttp(): HttpSuccess<{}> {
    return {
      status: 200,
      body: { data: {} },
    };
  },

  toFailureHttp(error: VerifyEmailError): HttpError {
    switch (error.kind) {
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
      case "not_found":
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
