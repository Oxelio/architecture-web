// @file bounded-contexts/iam/application/use-cases/suspend-user/suspend-user.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#services/administrator-authorizer.service";

import type { SuspendUserErrorCodes } from "./suspend-user.codes.js";

export type SuspendUserError =
  ValueOf<typeof SuspendUserErrorCodes> | AdministratorAuthorizationError;

export interface SuspendUserInput {
  readonly userId: string;
  readonly actorUserId: string;
}

export type SuspendUserOutput = Result<undefined, SuspendUserError>;

export interface SuspendUser {
  execute(command: SuspendUserInput): Promise<SuspendUserOutput>;
}
