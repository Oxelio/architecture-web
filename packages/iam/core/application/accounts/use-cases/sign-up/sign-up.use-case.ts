// @file bounded-contexts/iam/application/use-cases/sign-up/sign-up.use-case.ts

import { Result } from "@architecture/foundation";

import { EmailVerificationEntity } from "#entities/email-verification.entity";
import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import { UserEntity } from "#entities/user.entity";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { EmailSender } from "#services/email-sender.service";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import type { IamPolicyProvider } from "#services/iam-policy-provider.service";
import type { PasswordHasher } from "#services/password-hasher.service";
import type { PasswordPolicyValidator } from "#services/password-policy-validator.service";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import { EmailValueObject } from "#value-objects/email.value-object";
import { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

import { SignUpErrorCodes } from "./sign-up.codes.js";
import type {
  SignUpInput,
  SignUpOutput,
  UserRegistration,
} from "./sign-up.contracts.js";

export class SignUpUseCase {
  constructor(
    private readonly loginIdentities: LoginIdentityRepository,
    private readonly password: PasswordHasher,
    private readonly emailSender: EmailSender,
    private readonly tokenHasher: EmailVerificationTokenHasher,
    private readonly passwordPolicy: PasswordPolicyValidator,
    private readonly unitOfWork: IamUnitOfWork,
    private readonly policyProvider: IamPolicyProvider,
  ) {}

  async execute(payload: SignUpInput): Promise<SignUpOutput> {
    if (
      !(await this.policyProvider.isCapabilityEnabled(
        "accounts.publicRegistration",
      ))
    ) {
      return Result.failure(SignUpErrorCodes.featureDisabled);
    }
    const registrationPolicy =
      (await this.policyProvider.getAccountIdentityPolicy?.()) ?? {
        allowedLoginIdentifiers: ["email"] as const,
        requireEmailVerification: true,
      };
    if (
      !registrationPolicy.allowedLoginIdentifiers.includes(payload.login.kind)
    ) {
      return Result.failure(SignUpErrorCodes.loginIdentifierNotAllowed);
    }
    const login = LoginIdentifierValueObject.create(
      payload.login.kind,
      payload.login.value,
    );
    if (!login.success) {
      return Result.failure(login.error);
    }
    const existingIdentity = await this.loginIdentities.findByLogin(
      login.value,
    );
    if (existingIdentity) {
      return Result.failure(SignUpErrorCodes.userAlreadyExists);
    }

    const validation = await this.passwordPolicy.validate({
      password: payload.password,
      confirmation: payload.passwordConfirmation,
      ...(login.value.kind === "email"
        ? { context: { email: login.value.value } }
        : {}),
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

    const user = UserEntity.create();
    const identity = LoginIdentityEntity.create({
      userId: user.identifier,
      login: login.value,
      verificationRequired: registrationPolicy.requireEmailVerification,
    });
    const authenticator = PasswordAuthenticatorEntity.create({
      userId: user.identifier,
      passwordHash: hashedPassword,
    });

    const token =
      identity.verificationStatus === "pending"
        ? EmailVerificationTokenValueObject.generate()
        : null;
    const verification = token
      ? EmailVerificationEntity.create({
          userId: user.identifier,
          loginIdentityId: identity.identifier,
          tokenHash: await this.tokenHasher.hash(token),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        })
      : null;

    await this.unitOfWork.execute(
      async ({
        emailVerifications,
        loginIdentities,
        passwordAuthenticators,
        users,
      }) => {
        await users.save(user);
        await loginIdentities.save(identity);
        await passwordAuthenticators.save(authenticator);
        if (verification) {
          await emailVerifications.save(verification);
        }
      },
    );
    if (token && login.value.kind === "email") {
      const email = EmailValueObject.create(login.value.value);
      if (!email.success) {
        throw new Error("A validated email login must remain a valid email");
      }
      await this.emailSender.sendVerificationEmail(email.value, token.value);
    }

    const data: UserRegistration = {
      userId: user.identifier.value,
    };

    return Result.success(data);
  }
}
