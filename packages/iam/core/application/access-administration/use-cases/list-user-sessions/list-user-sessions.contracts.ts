import type { Result, ValueOf } from "@architecture/foundation";

import type { SessionSummary } from "#models/session-summary";
import type { AdministratorAuthorizationError } from "#services/administrator-authorizer.service";

import type { ListUserSessionsErrorCodes } from "./list-user-sessions.codes.js";

export interface ListUserSessionsInput {
  readonly actorUserId: string;
  readonly userId: string;
  readonly currentSessionId?: string;
}

export type ListUserSessionsError =
  ValueOf<typeof ListUserSessionsErrorCodes> | AdministratorAuthorizationError;
export type ListUserSessionsOutput = Result<
  readonly SessionSummary[],
  ListUserSessionsError
>;

export interface ListUserSessions {
  execute(input: ListUserSessionsInput): Promise<ListUserSessionsOutput>;
}
