// bounded-contexts/identity/application/features/register-user/register-user.result.ts

import type { Result } from "@architecture/foundation";

export type RegisterError =
  | {
      code: "USER_ALREADY_EXISTS";
    }
  | {
      code: "INVALID_EMAIL";
    }
  | {
      code: "PASSWORD_TOO_WEAK";
    };

interface RegisterUserResponse {
  userId: string;
}

export type RegisterResult = Result<RegisterUserResponse, RegisterError>;
