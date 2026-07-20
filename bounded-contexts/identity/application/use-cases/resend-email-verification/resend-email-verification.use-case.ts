// @file bounded-contexts/identity/application/use-cases/resend-email-verification/resend-email-verification.use-case.ts

import { Result } from "@architecture/foundation";
import { v4 as uuidv4 } from "uuid";

import type { EmailSenderPort } from "#ports/email-sender.port";
import type { EmailVerificationPort } from "#ports/email-verification.port";
import type { EmailVerificationRateLimitPort } from "#ports/email-verification-rate-limit.port";
import type { UserPort } from "#ports/user.port";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  ResendEmailVerificationErrorCodes,
  ResendEmailVerificationSuccessCodes,
} from "./resend-email-verification.codes.js";
import type {
  ResendEmailVerificationInput,
  ResendEmailVerificationOutput,
} from "./resend-email-verification.types.js";

export class ResendEmailVerificationUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly emailVerification: EmailVerificationPort,
    private readonly emailSender: EmailSenderPort,
    private readonly rateLimit: EmailVerificationRateLimitPort,
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

    const allowed = await this.rateLimit.canSend(user.identifier.value);

    if (!allowed) {
      return Result.failure(ResendEmailVerificationErrorCodes.tooManyRequests);
    }

    const token = uuidv4();

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.emailVerification.invalidatePrevious(user.identifier);

    await this.emailVerification.create(user.identifier, token, expiresAt);

    await this.emailSender.sendVerificationEmail(user.email, token);

    await this.rateLimit.registerSend(user.identifier.value);

    return Result.success(ResendEmailVerificationSuccessCodes.sent);
  }
}
