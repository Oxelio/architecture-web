// @file bounded-contexts/iam/application/use-cases/change-email/change-email.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { EmailError } from "#value-objects/email.value-object";

import type { ChangeEmailErrorsCodes } from "./change-email.codes.js";

export type ChangeEmailError =
  EmailError | ValueOf<typeof ChangeEmailErrorsCodes>;
export interface ChangeEmailInput {
  userId: string;
  email: string;
}
export type ChangeEmailOutput = Result<undefined, ChangeEmailError>;

export interface ChangeEmail {
  execute(command: ChangeEmailInput): Promise<ChangeEmailOutput>;
}
