import type { Result } from "@architecture/foundation";

export type AuthenticateError = {
  kind: "invalid_credentials";
};

export interface AuthenticateUserResponse {
  userId: string;
  sessionId: string;
}

export type AuthenticateResult = Result<
  AuthenticateUserResponse,
  AuthenticateError
>;
