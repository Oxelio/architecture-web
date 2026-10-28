// @file bounded-contexts/iam/application/use-cases/sign-up/sign-up.use-case.ts

import { Result } from "@architecture/foundation";

import type { RegistrationPolicyReader } from "#accounts/account-policy.reader";
import type { EmailVerificationTokenHasher } from "#accounts/email-verification/email-verification-token-hasher.port";
import type { VerificationEmailSender } from "#accounts/email-verification/verification-email-sender.port";
import type { PasswordValidation } from "#accounts/password-policy/password-validation";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import { EmailVerificationEntity } from "#entities/email-verification.entity";
import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import { UserEntity } from "#entities/user.entity";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
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
    private readonly emailSender: VerificationEmailSender,
    private readonly tokenHasher: EmailVerificationTokenHasher,
    private readonly passwordValidation: PasswordValidation,
    private readonly unitOfWork: IamUnitOfWork,
    private readonly accountPolicies: RegistrationPolicyReader,
  ) {}

  async execute(payload: SignUpInput): Promise<SignUpOutput> {
    const captured = await this.accountPolicies.getRegistrationPolicy();
    const registrationPolicy = captured.accounts;
    if (!registrationPolicy.publicRegistration) {
      return Result.failure(SignUpErrorCodes.featureDisabled);
    }
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

    const policy = captured.password;
    const validation = await this.passwordValidation.validate(policy, {
      password: payload.password,
      confirmation: payload.passwordConfirmation,
      context:
        login.value.kind === "email"
          ? { email: login.value.value }
          : { username: login.value.value },
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
      verificationRequired: registrationPolicy.emailVerification,
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
