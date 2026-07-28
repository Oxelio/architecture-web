import type { Result, ValueOf } from "@architecture/foundation";

import type { ListUserSessionsErrorCodes } from "./list-user-sessions.codes.js";

export interface AdminSession {
  readonly userId: string;
  readonly sessionId: string;
  readonly createdAt: string | null;
  readonly lastActivityAt: string | null;
  readonly expiresAt: string;
  readonly isActive: boolean;
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
      readonly approximate: true;
    } | null;
  };
}

export interface ListUserSessionsInput {
  readonly userId: string;
  readonly currentSessionId?: string;
}

export type ListUserSessionsError = ValueOf<typeof ListUserSessionsErrorCodes>;
export type ListUserSessionsOutput = Result<
  readonly AdminSession[],
  ListUserSessionsError
>;

export interface ListUserSessions {
  execute(input: ListUserSessionsInput): Promise<ListUserSessionsOutput>;
}
