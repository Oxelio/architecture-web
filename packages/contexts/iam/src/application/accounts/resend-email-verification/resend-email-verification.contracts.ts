import type { Result, ValueOf } from "@architecture/foundation";

import type { ResendEmailVerificationErrors } from "./resend-email-verification.errors.js";

export type ResendEmailVerificationError = ValueOf<
  typeof ResendEmailVerificationErrors
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
