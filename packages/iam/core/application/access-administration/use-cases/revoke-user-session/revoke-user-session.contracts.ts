import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#services/administrator-authorizer.service";

import type { RevokeUserSessionErrorCodes } from "./revoke-user-session.codes.js";

export interface RevokeUserSessionInput {
  readonly actorUserId: string;
  readonly userId: string;
  readonly sessionId?: string;
}

export type RevokeUserSessionError =
  ValueOf<typeof RevokeUserSessionErrorCodes> | AdministratorAuthorizationError;
export type RevokeUserSessionOutput = Result<void, RevokeUserSessionError>;

export interface RevokeUserSession {
  execute(input: RevokeUserSessionInput): Promise<RevokeUserSessionOutput>;
}
