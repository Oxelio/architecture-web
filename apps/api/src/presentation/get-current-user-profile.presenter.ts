// apps/api/src/presentation/get-my-profile.presenter.ts
import type {
  GetCurrentUserProfileResponse,
  GetCurrentUserProfileError,
} from "@architecture/identity/application";
import type { HttpError } from "./http-error.js";
import type { HttpSuccess } from "./http-success.js";

export const GetCurrentUserProfilePresenter = {
  toSuccessHttp(
    data: GetCurrentUserProfileResponse,
  ): HttpSuccess<GetCurrentUserProfileResponse> {
    return {
      status: 200,
      body: {
        data,
      },
    };
  },

  toFailureHttp(error: GetCurrentUserProfileError): HttpError {
    if (error.kind === "not_found") {
      return {
        status: 404,
        body: {
          error: {
            code: "NOT_FOUND",
          },
        },
      };
    }

    return {
      status: 500,
      body: {
        error: {
          code: "UNKNOWN_ERROR",
        },
      },
    };
  },
};
