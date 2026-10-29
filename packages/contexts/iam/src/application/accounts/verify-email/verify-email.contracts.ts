import type { Result, ValueOf } from "@architecture/foundation";

import type { VerifyEmailErrors } from "./verify-email.errors.js";

export type VerifyEmailError = ValueOf<typeof VerifyEmailErrors>;

export interface VerifyEmailInput {
  token: string;
}

export type VerifyEmailOutput = Result<void, VerifyEmailError>;

export interface VerifyEmail {
  execute(command: VerifyEmailInput): Promise<VerifyEmailOutput>;
}
