import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";

import type { RevokeUserSessionErrors } from "./revoke-user-session.errors.js";

export interface RevokeUserSessionInput {
  readonly actorUserId: string;
  readonly userId: string;
  readonly sessionId?: string;
}

export type RevokeUserSessionError =
  ValueOf<typeof RevokeUserSessionErrors> | AdministratorAuthorizationError;
export type RevokeUserSessionOutput = Result<void, RevokeUserSessionError>;

export interface RevokeUserSession {
  execute(input: RevokeUserSessionInput): Promise<RevokeUserSessionOutput>;
}
