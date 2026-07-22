// @file bounded-contexts/identity/application/use-cases/change-email/change-email.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { EmailError } from "#value-objects/email.value-object";

import type {
  ChangeEmailErrorsCodes,
  ChangeEmailSuccessCodes,
} from "./change-email.codes.js";

export interface ChangeEmailInput {
  userId: string;
  email: string;
}

export type ChangeEmailSuccess = ValueOf<typeof ChangeEmailSuccessCodes>;
export type ChangeEmailError =
  EmailError | ValueOf<typeof ChangeEmailErrorsCodes>;

export type ChangeEmailOutput = Result<ChangeEmailSuccess, ChangeEmailError>;
