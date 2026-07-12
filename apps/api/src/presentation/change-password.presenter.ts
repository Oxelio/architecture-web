import type { ChangePasswordError } from "@architecture/identity/application";
import type { EmptyResponse, HttpError, HttpSuccess } from "./http.types.js";

export const ChangePasswordPresenter = {
  toSuccessHttp(): HttpSuccess<EmptyResponse> {
    return {
      status: 200,
      body: { data: {} },
    };
  },

  toFailureHttp(error: ChangePasswordError): HttpError {
    if (error.code === "password.empty") {
      return {
        status: 400,
        body: { error: { code: "PASSWORD_REQUIRED" } },
      };
    }

    if (error.code === "password.too_short") {
      return {
        status: 400,
        body: { error: { code: "PASSWORD_TOO_SHORT" } },
      };
    }

    if (error.code === "user.not_found") {
      return {
        status: 404,
        body: { error: { code: "NOT_FOUND" } },
      };
    }

    return {
      status: 500,
      body: { error: { code: "UNKNOWN_ERROR" } },
    };
  },
};
