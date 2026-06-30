// bounded-contexts/identity/presentation/http/presenters/authenticate-user.presenter.ts
import type {
  AuthenticateUserResponse,
  AuthenticateError,
} from "#application/use-cases/authenticate-user/authenticate-user.result";

import type { HttpError } from "#presentation/http/presenters/http-error";
import { HttpSuccess } from "./http-success";

interface AuthenticateUserData {
  userId: string;
  sessionId: string;
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
          sessionId: data.sessionId,
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
