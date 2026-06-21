import type { Result } from "@architecture/foundation";

export interface AuthenticateError {
  code: "INVALID_CREDENTIALS";
}

export type AuthenticateResult = Result<void, AuthenticateError>;
