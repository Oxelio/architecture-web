import type { Result, ValueOf } from "@architecture/foundation";

import type { RevokeCurrentUserSessionErrors } from "./revoke-current-user-session.errors.js";

export interface RevokeCurrentUserSessionInput {
  readonly actorUserId: string;
  readonly sessionId: string;
}

export type RevokeCurrentUserSessionError = ValueOf<
  typeof RevokeCurrentUserSessionErrors
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
