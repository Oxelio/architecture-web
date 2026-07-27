import type { Result, ValueOf } from "@architecture/foundation";

import type { RevokeUserSessionErrorCodes } from "./revoke-user-session.codes.js";

export interface RevokeUserSessionInput {
  readonly userId: string;
  readonly sessionId?: string;
}

export type RevokeUserSessionError = ValueOf<
  typeof RevokeUserSessionErrorCodes
>;
export type RevokeUserSessionOutput = Result<void, RevokeUserSessionError>;

export interface RevokeUserSession {
  execute(input: RevokeUserSessionInput): Promise<RevokeUserSessionOutput>;
}
