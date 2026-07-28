import type { Result } from "@architecture/foundation";
import type { ValueOf } from "@architecture/foundation";

import type { SessionSummary } from "#models/session-summary";

import type { ListCurrentUserSessionsErrorCodes } from "./list-current-user-sessions.codes.js";

export interface ListCurrentUserSessionsInput {
  readonly actorUserId: string;
  readonly currentSessionId: string;
}

export type ListCurrentUserSessionsError = ValueOf<
  typeof ListCurrentUserSessionsErrorCodes
>;
export type ListCurrentUserSessionsOutput = Result<
  readonly SessionSummary[],
  ListCurrentUserSessionsError
>;

export interface ListCurrentUserSessions {
  execute(
    input: ListCurrentUserSessionsInput,
  ): Promise<ListCurrentUserSessionsOutput>;
}
