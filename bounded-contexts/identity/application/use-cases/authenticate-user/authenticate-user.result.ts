import type { Result } from "@architecture/foundation";

interface AuthenticateError {
  code: "INVALID_CREDENTIALS";
}

interface AuthenticateUserResponse {
  userId: string;
}

export type AuthenticateResult = Result<
  AuthenticateUserResponse,
  AuthenticateError
>;
