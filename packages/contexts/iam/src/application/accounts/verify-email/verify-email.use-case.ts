import { Result } from "@architecture/foundation";

import type { EmailVerificationTokenHasher } from "#accounts/email-verification/email-verification-token-hasher.port";
import type { EmailVerificationRepository } from "#ports/email-verification.repository";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";

import type {
  VerifyEmailInput,
  VerifyEmailOutput,
} from "./verify-email.contracts.js";
import { VerifyEmailErrors } from "./verify-email.errors.js";

export class VerifyEmailUseCase {
  constructor(
    private readonly loginIdentities: LoginIdentityRepository,
    private readonly emailVerification: EmailVerificationRepository,
    private readonly tokenHasher: EmailVerificationTokenHasher,
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(command: VerifyEmailInput): Promise<VerifyEmailOutput> {
    const token = EmailVerificationTokenValueObject.create(command.token);
    if (!token.success) {
      return Result.failure(VerifyEmailErrors.tokenInvalid);
    }

    const tokenHash = await this.tokenHasher.hash(token.value);
    const verification = await this.emailVerification.findByToken(tokenHash);
    if (!verification || verification.isUsed || verification.isInvalidated) {
      return Result.failure(VerifyEmailErrors.tokenInvalid);
    }

    const now = new Date();
    if (verification.isExpiredAt(now)) {
      return Result.failure(VerifyEmailErrors.tokenExpired);
    }

    const identity = await this.loginIdentities.findById(
      verification.loginIdentityId,
    );
    if (!identity) {
      return Result.failure(VerifyEmailErrors.userNotFound);
    }

    const consumed = await this.unitOfWork.executeForUser(
      identity.userId,
      async ({ emailVerifications, loginIdentities }) => {
        const current = await loginIdentities.findById(identity.identifier);
        if (!current?.login.equals(identity.login)) {
          return false;
        }
        const tokenConsumed = await emailVerifications.consume(
          tokenHash,
          new Date(),
        );
        if (!tokenConsumed) {
          return false;
        }
        current.verify();
        await loginIdentities.save(current);
        return true;
      },
    );
    if (!consumed) {
      return Result.failure(VerifyEmailErrors.tokenInvalid);
    }

    return Result.success(undefined);
  }
}
