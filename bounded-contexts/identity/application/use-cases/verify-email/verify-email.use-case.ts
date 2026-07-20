// @file bounded-contexts/identity/application/use-cases/verify-email/verify-email.use-case.ts

import { Result } from "@architecture/foundation";

import type { EmailVerificationPort } from "#application/ports/email-verification.port";
import type { UserPort } from "#application/ports/user.port";

import {
  VerifyEmailErrorCodes,
  VerifyEmailSuccessCodes,
} from "./verify-email.codes.js";
import type {
  VerifyEmailInput,
  VerifyEmailOutput,
} from "./verify-email.types.js";

export class VerifyEmailUseCase {
  constructor(
    private readonly userPort: UserPort,
    private readonly emailVerification: EmailVerificationPort,
  ) {}

  async execute(command: VerifyEmailInput): Promise<VerifyEmailOutput> {
    const record = await this.emailVerification.findByToken(command.token);
    if (!record) {
      return Result.failure(VerifyEmailErrorCodes.tokenInvalid);
    }

    if (record.used) {
      return Result.failure(VerifyEmailErrorCodes.tokenInvalid);
    }

    if (record.expiresAt.getTime() < Date.now()) {
      return Result.failure(VerifyEmailErrorCodes.tokenExpired);
    }

    const user = await this.userPort.findById(record.userId);
    if (!user) {
      return Result.failure(VerifyEmailErrorCodes.userNotFound);
    }

    user.verifyEmail();
    user.activate();
    await this.userPort.save(user);

    await this.emailVerification.markUsed(record.token);

    return Result.success(VerifyEmailSuccessCodes.verified);
  }
}
