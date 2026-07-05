import type { SuspendUserError } from "@architecture/identity/application";
import type { HttpError } from "./http-error.js";
import type { HttpSuccess } from "./http-success.js";

export const SuspendUserPresenter = {
  toSuccessHttp(): HttpSuccess<{}> {
    return {
      status: 200,
      body: { data: {} },
    };
  },

  toFailureHttp(error: SuspendUserError): HttpError {
    if (error.kind === "not_found") {
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
