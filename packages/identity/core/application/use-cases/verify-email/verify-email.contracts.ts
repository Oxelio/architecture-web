// @file bounded-contexts/identity/application/use-cases/verify-email/verify-email.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { VerifyEmailErrorCodes } from "./verify-email.codes.js";

export type VerifyEmailError = ValueOf<typeof VerifyEmailErrorCodes>;

export interface VerifyEmailInput {
  token: string;
}

export type VerifyEmailOutput = Result<undefined, VerifyEmailError>;

export interface VerifyEmail {
  execute(command: VerifyEmailInput): Promise<VerifyEmailOutput>;
}
