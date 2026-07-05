import type { ChangePasswordError } from "@architecture/identity/application";
import type { HttpError } from "./http-error.js";
import type { HttpSuccess } from "./http-success.js";

export const ChangePasswordPresenter = {
  toSuccessHttp(): HttpSuccess<{}> {
    return {
      status: 200,
      body: { data: {} },
    };
  },

  toFailureHttp(error: ChangePasswordError): HttpError {
    if (error.kind === "password.empty") {
      return {
        status: 400,
        body: { error: { code: "PASSWORD_REQUIRED" } },
      };
    }

    if (error.kind === "password.too_short") {
      return {
        status: 400,
        body: { error: { code: "PASSWORD_TOO_SHORT" } },
      };
    }

    if (error.kind === "user.not_found") {
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
