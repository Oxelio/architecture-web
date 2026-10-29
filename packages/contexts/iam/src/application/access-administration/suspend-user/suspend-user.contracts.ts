import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";

import type { SuspendUserErrors } from "./suspend-user.errors.js";

export type SuspendUserError =
  ValueOf<typeof SuspendUserErrors> | AdministratorAuthorizationError;

export interface SuspendUserInput {
  readonly userId: string;
  readonly actorUserId: string;
}

export type SuspendUserOutput = Result<void, SuspendUserError>;

export interface SuspendUser {
  execute(command: SuspendUserInput): Promise<SuspendUserOutput>;
}
