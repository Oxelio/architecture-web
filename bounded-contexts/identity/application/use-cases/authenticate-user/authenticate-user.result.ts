import type { Result } from "@architecture/foundation";

export interface AuthenticateError {
  kind: "invalid_credentials";
}

export interface AuthenticateUserResponse {
  userId: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

export type AuthenticateResult = Result<
  AuthenticateUserResponse,
  AuthenticateError
>;
