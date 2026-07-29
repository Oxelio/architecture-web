// @file bounded-contexts/iam/application/use-cases/verify-email/verify-email.use-case.ts

import { Result } from "@architecture/foundation";

import type { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
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
    private readonly unitOfWork: IamUnitOfWork,
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

    user.verifyEmail();
    const consumed = await this.unitOfWork.execute(
      async ({ emailVerifications, users }) => {
        const tokenConsumed = await emailVerifications.consume(tokenHash, now);
        if (!tokenConsumed) {
          return false;
        }
        await users.save(user);
        return true;
      },
    );
    if (!consumed) {
      return Result.failure(VerifyEmailErrorCodes.tokenInvalid);
    }

    return Result.success(undefined);
  }
}
