// apps/api/src/presentation/get-my-profile.presenter.ts
import type {
  GetUserProfileResponse,
  GetUserProfileError,
} from "@architecture/identity/application";
import type { HttpError } from "./http-error.js";
import type { HttpSuccess } from "./http-success.js";

interface GetUserProfileResponseDto {
  userId: string;
  email: string;
}

export const GetUserProfilePresenter = {
  toSuccessHttp(
    data: GetUserProfileResponse,
  ): HttpSuccess<GetUserProfileResponseDto> {
    const dto: GetUserProfileResponseDto = {
      userId: data.userId,
      email: data.email,
    };

    return {
      status: 200,
      body: {
        data: dto,
      },
    };
  },

  toFailureHttp(error: GetUserProfileError): HttpError {
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
