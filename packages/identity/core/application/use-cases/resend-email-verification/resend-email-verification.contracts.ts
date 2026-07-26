// @file bounded-contexts/identity/application/use-cases/resend-email-verification/resend-email-verification.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { ResendEmailVerificationErrorCodes } from "./resend-email-verification.codes.js";

export type ResendEmailVerificationError = ValueOf<
  typeof ResendEmailVerificationErrorCodes
>;

export interface ResendEmailVerificationInput {
  userId: string;
}

export type ResendEmailVerificationOutput = Result<
  undefined,
  ResendEmailVerificationError
>;

export interface ResendEmailVerification {
  execute(
    command: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationOutput>;
}
