// @file bounded-contexts/iam/application/use-cases/resend-email-verification/resend-email-verification.use-case.ts

import { Result } from "@architecture/foundation";

import { EmailVerificationEntity } from "#entities/email-verification.entity";
import type { UserRepository } from "#repositories/user.repository";
import type { EmailSender } from "#services/email-sender.service";
import type { EmailVerificationRateLimiter } from "#services/email-verification-rate-limiter.service";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ResendEmailVerificationErrorCodes } from "./resend-email-verification.codes.js";
import type {
  ResendEmailVerification,
  ResendEmailVerificationInput,
  ResendEmailVerificationOutput,
} from "./resend-email-verification.contracts.js";

export class ResendEmailVerificationUseCase implements ResendEmailVerification {
  constructor(
    private readonly user: UserRepository,
    private readonly emailSender: EmailSender,
    private readonly rateLimiter: EmailVerificationRateLimiter,
    private readonly tokenHasher: EmailVerificationTokenHasher,
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(
    payload: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationOutput> {
    const userValueObject = UserIdentifierValueObject.create(payload.userId);
    if (!userValueObject.success) {
      return Result.failure(ResendEmailVerificationErrorCodes.invalidId);
    }

    const user = await this.user.findById(userValueObject.value);
    if (!user) {
      return Result.failure(ResendEmailVerificationErrorCodes.userNotFound);
    }

    if (user.isEmailVerified) {
      return Result.failure(ResendEmailVerificationErrorCodes.alreadyVerified);
    }

    const allowed = await this.rateLimiter.isAllowed(user.identifier);
    if (!allowed) {
      return Result.failure(ResendEmailVerificationErrorCodes.tooManyRequests);
    }

    const token = EmailVerificationTokenValueObject.generate();
    const tokenHash = await this.tokenHasher.hash(token);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const verification = EmailVerificationEntity.create({
      userId: user.identifier,
      tokenHash,
      expiresAt,
    });

    await this.unitOfWork.execute(async ({ emailVerifications }) => {
      await emailVerifications.invalidatePreviousFor(user.identifier);
      await emailVerifications.save(verification);
    });

    await this.emailSender.sendVerificationEmail(user.email, token.value);

    await this.rateLimiter.recordSuccess(user.identifier);

    return Result.success(undefined);
  }
}
