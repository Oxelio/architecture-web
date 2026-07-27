import type { Result, ValueOf } from "@architecture/foundation";

import type { ListUserSessionsErrorCodes } from "./list-user-sessions.codes.js";

export interface AdminSession {
  readonly sessionId: string;
  readonly expiresAt: string;
}

export interface ListUserSessionsInput {
  readonly userId: string;
}

export type ListUserSessionsError = ValueOf<typeof ListUserSessionsErrorCodes>;
export type ListUserSessionsOutput = Result<
  readonly AdminSession[],
  ListUserSessionsError
>;

export interface ListUserSessions {
  execute(input: ListUserSessionsInput): Promise<ListUserSessionsOutput>;
}
