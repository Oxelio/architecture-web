import type { Result } from "@architecture/foundation";

export interface ValidateSessionError {
  kind: "unauthorized";
}

export interface ValidateSessionResponse {
  userId: string;
  sessionId: string;
}

export type ValidateSessionResult = Result<
  ValidateSessionResponse,
  ValidateSessionError
>;
