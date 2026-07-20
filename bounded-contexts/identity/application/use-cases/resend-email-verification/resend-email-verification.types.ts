// @file bounded-contexts/identity/application/use-cases/resend-email-verification/resend-email-verification.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type {
  ResendEmailVerificationErrorCodes,
  ResendEmailVerificationSuccessCodes,
} from "./resend-email-verification.codes.js";

export interface ResendEmailVerificationInput {
  userId: string;
}

export type ResendEmailVerificationSuccess = ValueOf<
  typeof ResendEmailVerificationSuccessCodes
>;
export type ResendEmailVerificationError = ValueOf<
  typeof ResendEmailVerificationErrorCodes
>;

export type ResendEmailVerificationOutput = Result<
  ResendEmailVerificationSuccess,
  ResendEmailVerificationError
>;
