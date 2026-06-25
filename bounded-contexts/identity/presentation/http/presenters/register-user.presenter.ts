// bounded-contexts/identity/presentation/http/fastify/presenters/register-user.presenter.ts

import type { RegisterUserResponse } from "#application/use-cases/register-user/register-user.result";
import type { ApiResponse } from "#presentation/http/presenters/api-response";

interface RegisterUserData {
  userId: string;
}

export const RegisterUserPresenter = {
  toHttp(data: RegisterUserResponse): ApiResponse<RegisterUserData> {
    return {
      data: {
        userId: data.userId,
      },
    };
  },
};
