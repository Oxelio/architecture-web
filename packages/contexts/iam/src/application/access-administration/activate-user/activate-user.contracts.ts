// @file bounded-contexts/iam/application/use-cases/activate-user/activate-user.types.ts

import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";

import type { ActivateUserErrorsCodes } from "./activate-user.codes.js";

export type ActivateUserError =
  ValueOf<typeof ActivateUserErrorsCodes> | AdministratorAuthorizationError;

export interface ActivateUserInput {
  readonly actorUserId: string;
  readonly userId: string;
}

export type ActivateUserOutput = Result<void, ActivateUserError>;

export interface ActivateUser {
  execute(command: ActivateUserInput): Promise<ActivateUserOutput>;
}
