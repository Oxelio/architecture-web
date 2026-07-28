import type { Result, ValueOf } from "@architecture/foundation";

import type { RevokeCurrentUserSessionErrorCodes } from "./revoke-current-user-session.codes.js";

export interface RevokeCurrentUserSessionInput {
  readonly actorUserId: string;
  readonly sessionId: string;
}

export type RevokeCurrentUserSessionError = ValueOf<
  typeof RevokeCurrentUserSessionErrorCodes
>;
export type RevokeCurrentUserSessionOutput = Result<
  void,
  RevokeCurrentUserSessionError
>;

export interface RevokeCurrentUserSession {
  execute(
    input: RevokeCurrentUserSessionInput,
  ): Promise<RevokeCurrentUserSessionOutput>;
}
