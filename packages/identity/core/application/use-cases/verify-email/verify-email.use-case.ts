// @file bounded-contexts/identity/application/use-cases/verify-email/verify-email.use-case.ts

import { Result } from "@architecture/foundation";

import type { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";

import { VerifyEmailErrorCodes } from "./verify-email.codes.js";
import type {
  VerifyEmailInput,
  VerifyEmailOutput,
} from "./verify-email.contracts.js";

export class VerifyEmailUseCase {
  constructor(
    private readonly userPort: UserRepository,
    private readonly emailVerification: EmailVerificationRepository,
    private readonly tokenHasher: EmailVerificationTokenHasher,
  ) {}

  async execute(command: VerifyEmailInput): Promise<VerifyEmailOutput> {
    const token = EmailVerificationTokenValueObject.create(command.token);
    if (!token.success) {
      return Result.failure(VerifyEmailErrorCodes.tokenInvalid);
    }

    const tokenHash = await this.tokenHasher.hash(token.value);
    const verification = await this.emailVerification.findByToken(tokenHash);
    if (!verification || verification.isUsed || verification.isInvalidated) {
      return Result.failure(VerifyEmailErrorCodes.tokenInvalid);
    }

    const now = new Date();
    if (verification.isExpiredAt(now)) {
      return Result.failure(VerifyEmailErrorCodes.tokenExpired);
    }

    const user = await this.userPort.findById(verification.userId);
    if (!user) {
      return Result.failure(VerifyEmailErrorCodes.userNotFound);
    }

    const consumed = await this.emailVerification.consume(tokenHash, now);
    if (!consumed) {
      return Result.failure(VerifyEmailErrorCodes.tokenInvalid);
    }

    user.verifyEmail();
    user.activate();
    await this.userPort.save(user);

    return Result.success(undefined);
  }
}
