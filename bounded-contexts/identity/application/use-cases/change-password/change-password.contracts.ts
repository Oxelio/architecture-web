// @file bounded-contexts/identity/application/use-cases/change-password/change-password.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

import type { ChangePasswordErrorsCodes } from "./change-password.codes.js";

export type ChangePasswordError =
  PlainPasswordError | ValueOf<typeof ChangePasswordErrorsCodes>;

export interface ChangePasswordInput {
  userId: string;
  password: string;
}

export type ChangePasswordOutput = Result<undefined, ChangePasswordError>;

export interface ChangePassword {
  execute(command: ChangePasswordInput): Promise<ChangePasswordOutput>;
}
