import type { Result, ValueOf } from "@architecture/foundation";

import type { EmailError } from "#value-objects/email.value-object";

import type { ChangeEmailErrors } from "./change-email.errors.js";

export type ChangeEmailError = EmailError | ValueOf<typeof ChangeEmailErrors>;
export interface ChangeEmailInput {
  userId: string;
  email: string;
}
export type ChangeEmailOutput = Result<void, ChangeEmailError>;

export interface ChangeEmail {
  execute(command: ChangeEmailInput): Promise<ChangeEmailOutput>;
}
