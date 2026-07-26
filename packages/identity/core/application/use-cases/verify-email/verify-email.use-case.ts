// @file bounded-contexts/identity/application/use-cases/verify-email/verify-email.use-case.ts

import { Result } from "@architecture/foundation";

import type { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { UserRepository } from "#repositories/user.repository";

import { VerifyEmailErrorCodes } from "./verify-email.codes.js";
import type {
  VerifyEmailInput,
  VerifyEmailOutput,
} from "./verify-email.contracts.js";

export class VerifyEmailUseCase {
  constructor(
    private readonly userPort: UserRepository,
    private readonly emailVerification: EmailVerificationRepository,
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

    return Result.success(undefined);
  }
}
