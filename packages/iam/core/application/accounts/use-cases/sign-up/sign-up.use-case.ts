// @file bounded-contexts/iam/application/use-cases/sign-up/sign-up.use-case.ts

import { Result } from "@architecture/foundation";

import { EmailVerificationEntity } from "#entities/email-verification.entity";
import { UserEntity } from "#entities/user.entity";
import type { UserRepository } from "#repositories/user.repository";
import type { EmailSender } from "#services/email-sender.service";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import type { IamPolicyProvider } from "#services/iam-policy-provider.service";
import type { PasswordHasher } from "#services/password-hasher.service";
import type { PasswordPolicyValidator } from "#services/password-policy-validator.service";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import { EmailValueObject } from "#value-objects/email.value-object";
import { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

import { SignUpErrorCodes } from "./sign-up.codes.js";
import type {
  SignUpInput,
  SignUpOutput,
  UserRegistration,
} from "./sign-up.contracts.js";

export class SignUpUseCase {
  constructor(
    private readonly user: UserRepository,
    private readonly password: PasswordHasher,
    private readonly emailSender: EmailSender,
    private readonly tokenHasher: EmailVerificationTokenHasher,
    private readonly passwordPolicy: PasswordPolicyValidator,
    private readonly unitOfWork: IamUnitOfWork,
    private readonly policyProvider?: IamPolicyProvider,
  ) {}

  async execute(payload: SignUpInput): Promise<SignUpOutput> {
    if (
      this.policyProvider &&
      !(await this.policyProvider.isCapabilityEnabled(
        "accounts.publicRegistration",
      ))
    ) {
      return Result.failure(SignUpErrorCodes.featureDisabled);
    }
    const email = EmailValueObject.create(payload.email);
    if (!email.success) {
      return Result.failure(email.error);
    }

    const existingUser = await this.user.findByEmail(email.value);
    if (existingUser) {
      return Result.failure(SignUpErrorCodes.userAlreadyExists);
    }

    const validation = await this.passwordPolicy.validate({
      password: payload.password,
      confirmation: payload.passwordConfirmation,
      context: { email: email.value.value },
    });
    const firstValidationError = validation.errors[0];
    if (firstValidationError) {
      return Result.failure(firstValidationError);
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(password.error);
    }

    const hashedPassword = await this.password.hash(password.value);

    const user = UserEntity.create({
      email: email.value,
      password: hashedPassword,
    });
    const token = EmailVerificationTokenValueObject.generate();
    const tokenHash = await this.tokenHasher.hash(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    const verification = EmailVerificationEntity.create({
      userId: user.identifier,
      tokenHash,
      expiresAt,
    });
    await this.unitOfWork.execute(async ({ emailVerifications, users }) => {
      await users.save(user);
      await emailVerifications.save(verification);
    });
    await this.emailSender.sendVerificationEmail(email.value, token.value);

    const data: UserRegistration = {
      userId: user.identifier.value,
    };

    return Result.success(data);
  }
}
