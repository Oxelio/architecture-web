// @file bounded-contexts/identity/application/use-cases/verify-email/verify-email.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type {
  VerifyEmailErrorCodes,
  VerifyEmailSuccessCodes,
} from "./verify-email.codes.js";

export interface VerifyEmailInput {
  token: string;
}

export type VerifyEmailSuccess = ValueOf<typeof VerifyEmailSuccessCodes>;

export type VerifyEmailError = ValueOf<typeof VerifyEmailErrorCodes>;

export type VerifyEmailOutput = Result<VerifyEmailSuccess, VerifyEmailError>;
