import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";

import type { ListUserSessionsErrors } from "./list-user-sessions.errors.js";

export interface ListUserSessionsInput {
  readonly actorUserId: string;
  readonly userId: string;
}

export interface AdministeredUserSession {
  readonly sessionId: string;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
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

export type ListUserSessionsError =
  ValueOf<typeof ListUserSessionsErrors> | AdministratorAuthorizationError;
export type ListUserSessionsOutput = Result<
  readonly AdministeredUserSession[],
  ListUserSessionsError
>;

export interface ListUserSessions {
  execute(input: ListUserSessionsInput): Promise<ListUserSessionsOutput>;
}
