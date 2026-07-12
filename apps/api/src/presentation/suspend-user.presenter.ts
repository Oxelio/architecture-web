import type { SuspendUserError } from "@architecture/identity/application";
import type { EmptyResponse, HttpError, HttpSuccess } from "./http.types.js";

export const SuspendUserPresenter = {
  toSuccessHttp(): HttpSuccess<EmptyResponse> {
    return {
      status: 200,
      body: { data: {} },
    };
  },

  toFailureHttp(error: SuspendUserError): HttpError {
    if (error.code === "not_found") {
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
