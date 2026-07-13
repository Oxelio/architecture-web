import { v4 as uuidv4 } from "uuid";
import type { UserPort } from "#ports/user.port";
import type { EmailSenderPort } from "#ports/email-sender.port";
import type { EmailVerificationPort } from "#ports/email-verification.port";
import type { EmailVerificationRateLimitPort } from "#ports/email-verification-rate-limit.port";
import { Result, type ErrorOf } from "@architecture/foundation";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface ResendEmailVerificationInput {
  userId: string;
}

const ResendEmailVerificationErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  userNotFound: {
    code: "user.not_found",
  },

  alreadyVerified: {
    code: "user.email_already_verified",
  },

  tooManyRequests: {
    code: "email_verification.too_many_requests",
  },
} as const;

export type ResendEmailVerificationError = ErrorOf<
  typeof ResendEmailVerificationErrors
>;

export interface ResendEmailVerificationResponse {
  sent: boolean;
}

export type ResendEmailVerificationResult = Result<
  ResendEmailVerificationResponse,
  ResendEmailVerificationError
>;

export class ResendEmailVerificationUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly emailVerification: EmailVerificationPort,
    private readonly emailSender: EmailSenderPort,
    private readonly rateLimit: EmailVerificationRateLimitPort,
  ) {}

  async execute(
    payload: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationResult> {
    const userValueObject = UserIdentifierValueObject.create(payload.userId);
    if (!userValueObject.success) {
      return Result.failure(ResendEmailVerificationErrors.invalidId);
    }
    const user = await this.user.findById(userValueObject.value);

    if (!user) {
      return Result.failure(ResendEmailVerificationErrors.userNotFound);
    }

    if (user.isEmailVerified) {
      return Result.failure(ResendEmailVerificationErrors.alreadyVerified);
    }

    const allowed = await this.rateLimit.canSend(user.identifier.value);

    if (!allowed) {
      return Result.failure(ResendEmailVerificationErrors.tooManyRequests);
    }

    const token = uuidv4();

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.emailVerification.invalidatePrevious(user.identifier);

    await this.emailVerification.create(user.identifier, token, expiresAt);

    await this.emailSender.sendVerificationEmail(user.email, token);

    await this.rateLimit.registerSend(user.identifier.value);

    return Result.ok({
      sent: true,
    });
  }
}
