import type { ResendEmailVerificationError } from "@architecture/identity/application";
import type { EmptyResponse, HttpError, HttpSuccess } from "./http.types.js";

export const ResendEmailVerificationPresenter = {
  toSuccessHttp(): HttpSuccess<EmptyResponse> {
    return {
      status: 200,
      body: {
        data: {},
      },
    };
  },

  toFailureHttp(error: ResendEmailVerificationError): HttpError {
    switch (error.code) {
      case "user.email_already_verified":
        return {
          status: 409,
          body: {
            error: {
              code: "EMAIL_ALREADY_VERIFIED",
            },
          },
        };

      case "email_verification.too_many_requests":
        return {
          status: 429,
          body: {
            error: {
              code: "TOO_MANY_REQUESTS",
            },
          },
        };

      case "user.not_found":
        return {
          status: 404,
          body: {
            error: {
              code: "NOT_FOUND",
            },
          },
        };

      default:
        return {
          status: 500,
          body: {
            error: {
              code: "UNKNOWN_ERROR",
            },
          },
        };
    }
  },
};
