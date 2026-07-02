// bounded-contexts/identity/presentation/http/presenters/authenticate-user.presenter.ts
import type {
  AuthenticateError,
  AuthenticateUserResponse,
} from "@architecture/identity/application";
import type { HttpError } from "./http-error.js";
import type { HttpSuccess } from "./http-success.js";

interface AuthenticateUserData {
  userId: string;
}

export const AuthenticateUserPresenter = {
  toSuccessHttp(
    data: AuthenticateUserResponse,
  ): HttpSuccess<AuthenticateUserData> {
    return {
      status: 200,
      body: {
        data: {
          userId: data.userId,
        },
      },
    };
  },

  toFailureHttp(error: AuthenticateError): HttpError {
    if (error.kind === "invalid_credentials") {
      return {
        status: 401,
        body: {
          error: {
            code: "INVALID_CREDENTIALS",
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
