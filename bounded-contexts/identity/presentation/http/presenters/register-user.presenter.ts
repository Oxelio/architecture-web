// bounded-contexts/identity/presentation/http/fastify/presenters/register-user.presenter.ts

import type {
  RegisterUserResponse,
  RegisterError,
} from "#application/use-cases/register-user/register-user.result";
import type { HttpError } from "#presentation/http/presenters/http-error";
import type { HttpSuccess } from "./http-success.js";

interface RegisterUserData {
  userId: string;
}

export const RegisterUserPresenter = {
  toSuccessHttp(data: RegisterUserResponse): HttpSuccess<RegisterUserData> {
    return {
      status: 201,
      body: {
        data: {
          userId: data.userId,
        },
      },
    };
  },

  toFailureHttp(error: RegisterError): HttpError {
    switch (error.kind) {
      case "email.empty":
        return {
          status: 400,
          body: {
            error: {
              code: "EMAIL_REQUIRED",
            },
          },
        };

      case "email.invalid_format":
        return {
          status: 400,
          body: {
            error: {
              code: "EMAIL_INVALID",
            },
          },
        };

      case "email.too_long":
        return {
          status: 400,
          body: {
            error: {
              code: "EMAIL_TOO_LONG",
            },
          },
        };

      case "password.empty":
        return {
          status: 400,
          body: {
            error: {
              code: "PASSWORD_REQUIRED",
            },
          },
        };

      case "password.too_short":
        return {
          status: 400,
          body: {
            error: {
              code: "PASSWORD_TOO_SHORT",
            },
          },
        };

      case "user.already_exists":
        return {
          status: 409,
          body: {
            error: {
              code: "USER_ALREADY_EXISTS",
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
