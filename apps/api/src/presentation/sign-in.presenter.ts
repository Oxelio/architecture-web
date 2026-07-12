// bounded-contexts/identity/presentation/http/presenters/authenticate-user.presenter.ts
import type {
  SignInError,
  SignInResponse,
} from "@architecture/identity/application";
import type { HttpError, HttpSuccess } from "./http.types.js";

interface SignInResponseDto {
  userId: string;
}

export const SignInPresenter = {
  toSuccessHttp(data: SignInResponse): HttpSuccess<SignInResponseDto> {
    const dto: SignInResponseDto = {
      userId: data.userId,
    };

    return {
      status: 200,
      body: {
        data: dto,
      },
    };
  },

  toFailureHttp(error: SignInError): HttpError {
    if (error.code === "user.invalid_credentials") {
      return {
        status: 401,
        body: {
          error: {
            code: "INVALID_CREDENTIALS",
          },
        },
      };
    }

    if (error.code === "user.suspended") {
      return {
        status: 403,
        body: {
          error: {
            code: "USER_SUSPENDED",
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
