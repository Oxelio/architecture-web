import type { Result, ValueOf } from "@architecture/foundation";

import type { ListCurrentUserSessionsErrors } from "./list-current-user-sessions.errors.js";

export interface ListCurrentUserSessionsInput {
  readonly actorUserId: string;
  readonly currentSessionId: string;
}

export interface CurrentUserSession {
  readonly sessionId: string;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
  readonly isCurrent: boolean;
  readonly client: {
    readonly type: "browser" | "application" | "unknown";
    readonly name: string | null;
    readonly version: string | null;
    readonly deviceType: "desktop" | "phone" | "tablet" | "unknown";
    readonly operatingSystem: {
      readonly name: string;
      readonly version: string | null;
    } | null;
  };
  readonly network: {
    readonly ipAddress: string | null;
    readonly location: {
      readonly country: string;
      readonly region: string | null;
      readonly city: string | null;
    } | null;
  };
}

export type ListCurrentUserSessionsError = ValueOf<
  typeof ListCurrentUserSessionsErrors
>;
export type ListCurrentUserSessionsOutput = Result<
  readonly CurrentUserSession[],
  ListCurrentUserSessionsError
>;

export interface ListCurrentUserSessions {
  execute(
    input: ListCurrentUserSessionsInput,
  ): Promise<ListCurrentUserSessionsOutput>;
}
