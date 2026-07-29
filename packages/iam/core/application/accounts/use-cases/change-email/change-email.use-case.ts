// @file bounded-contexts/iam/application/use-cases/change-email/change-email.use-case.ts

import { Result } from "@architecture/foundation";

import { EmailVerificationEntity } from "#entities/email-verification.entity";
import type { UserRepository } from "#repositories/user.repository";
import type { EmailSender } from "#services/email-sender.service";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import type { IamPolicyProvider } from "#services/iam-policy-provider.service";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import { EmailValueObject } from "#value-objects/email.value-object";
import { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ChangeEmailErrorsCodes } from "./change-email.codes.js";
import type {
  ChangeEmail,
  ChangeEmailInput,
  ChangeEmailOutput,
} from "./change-email.contracts.js";

export class ChangeEmailUseCase implements ChangeEmail {
  constructor(
    private readonly userPort: UserRepository,
    private readonly emailSender: EmailSender,
    private readonly tokenHasher: EmailVerificationTokenHasher,
    private readonly unitOfWork: IamUnitOfWork,
    private readonly policyProvider?: IamPolicyProvider,
  ) {}

  async execute(command: ChangeEmailInput): Promise<ChangeEmailOutput> {
    if (
      this.policyProvider &&
      !(await this.policyProvider.isCapabilityEnabled("accounts.emailChange"))
    ) {
      return Result.failure(ChangeEmailErrorsCodes.featureDisabled);
    }
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(ChangeEmailErrorsCodes.invalidId);
    }

    const email = EmailValueObject.create(command.email);
    if (!email.success) {
      return Result.failure(email.error);
    }

    // check existing email
    const existing = await this.userPort.findByEmail(email.value);
    if (existing && existing.identifier.value !== userId.value.value) {
      return Result.failure(ChangeEmailErrorsCodes.userAlreadyExists);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ChangeEmailErrorsCodes.notFound);
    }

    if (user.email.equals(email.value)) {
      return Result.success(undefined);
    }

    user.changeEmail(email.value);

    const token = EmailVerificationTokenValueObject.generate();
    const tokenHash = await this.tokenHasher.hash(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const verification = EmailVerificationEntity.create({
      userId: user.identifier,
      tokenHash,
      expiresAt,
    });

    await this.unitOfWork.execute(async ({ emailVerifications, users }) => {
      await users.save(user);
      await emailVerifications.invalidatePreviousFor(user.identifier);
      await emailVerifications.save(verification);
    });
    await this.emailSender.sendVerificationEmail(user.email, token.value);

    return Result.success(undefined);
  }
}
