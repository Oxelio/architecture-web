// @file bounded-contexts/identity/application/use-cases/activate-user/activate-user.types.ts

import type { Result, ValueOf } from "@architecture/foundation";

import type { ActivateUserErrorsCodes } from "./activate-user.codes.js";

export type ActivateUserError = ValueOf<typeof ActivateUserErrorsCodes>;

export interface ActivateUserInput {
  readonly userId: string;
}

export type ActivateUserOutput = Result<void, ActivateUserError>;

export interface ActivateUser {
  execute(command: ActivateUserInput): Promise<ActivateUserOutput>;
}
