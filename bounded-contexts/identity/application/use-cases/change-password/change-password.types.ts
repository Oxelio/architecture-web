// @file bounded-contexts/identity/application/use-cases/change-password/change-password.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

import type {
  ChangePasswordErrorsCodes,
  ChangePasswordSuccessCodes,
} from "./change-password.codes.js";

export interface ChangePasswordInput {
  userId: string;
  password: string;
}

export type ChangePasswordSuccess = ValueOf<typeof ChangePasswordSuccessCodes>;
export type ChangePasswordError =
  | PlainPasswordError
  | ValueOf<typeof ChangePasswordErrorsCodes>;

export type ChangePasswordOutput = Result<
  ChangePasswordSuccess,
  ChangePasswordError
>;
