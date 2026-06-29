import type { Result } from "@architecture/foundation";

export type AuthenticateError =
  | {
      code: "INVALID_CREDENTIALS";
    }
  | {
      code: "INVALID_EMAIL";
    }
  | {
      code: "INVALID_PASSWORD";
    };

interface AuthenticateUserResponse {
  userId: string;
}

export type AuthenticateResult = Result<
  AuthenticateUserResponse,
  AuthenticateError
>;
