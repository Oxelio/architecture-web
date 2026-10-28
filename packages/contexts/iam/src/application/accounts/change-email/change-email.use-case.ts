// @file bounded-contexts/iam/application/use-cases/change-email/change-email.use-case.ts

import { Result } from "@architecture/foundation";

import type { AccountPolicyReader } from "#accounts/account-policy.reader";
import type { EmailVerificationTokenHasher } from "#accounts/email-verification/email-verification-token-hasher.port";
import type { VerificationEmailSender } from "#accounts/email-verification/verification-email-sender.port";
import { EmailVerificationEntity } from "#entities/email-verification.entity";
import { LoginIdentityEntity } from "#entities/login-identity.entity";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import { EmailValueObject } from "#value-objects/email.value-object";
import { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
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
    private readonly loginIdentities: LoginIdentityRepository,
    private readonly emailSender: VerificationEmailSender,
    private readonly tokenHasher: EmailVerificationTokenHasher,
    private readonly unitOfWork: IamUnitOfWork,
    private readonly policies: AccountPolicyReader,
  ) {}

  async execute(command: ChangeEmailInput): Promise<ChangeEmailOutput> {
    const accountPolicy = await this.policies.getAccountPolicy();
    if (!accountPolicy.emailChange) {
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

    const login = LoginIdentifierValueObject.create("email", email.value.value);
    if (!login.success) {
      throw new Error("A validated email must be a valid login identifier");
    }
    const existing = await this.loginIdentities.findByLogin(login.value);
    if (existing && existing.userId.value !== userId.value.value) {
      return Result.failure(ChangeEmailErrorsCodes.userAlreadyExists);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ChangeEmailErrorsCodes.notFound);
    }

    const currentIdentity = await this.loginIdentities.findForUser(
      user.identifier,
      "email",
    );
    if (currentIdentity?.login.equals(login.value)) {
      return Result.success(undefined);
    }

    const verificationRequired = accountPolicy.emailVerification;
    const identity =
      currentIdentity ??
      LoginIdentityEntity.create({
        userId: user.identifier,
        login: login.value,
        verificationRequired: verificationRequired,
      });
    if (currentIdentity) {
      identity.replace(login.value, verificationRequired);
    }

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

    const committed = await this.unitOfWork.executeForUser(
      user.identifier,
      async ({ emailVerifications, loginIdentities }) => {
        if (
          !(await loginIdentities.replacePreservingAdministrativeAccess(
            identity,
          ))
        ) {
          return false;
        }
        await emailVerifications.invalidatePreviousFor(identity.identifier);
        if (verification) {
          await emailVerifications.save(verification);
        }
        return true;
      },
    );
    if (!committed) {
      return Result.failure(ChangeEmailErrorsCodes.lastActiveAdministrator);
    }
    if (token) {
      await this.emailSender.sendVerificationEmail(email.value, token.value);
    }

    return Result.success(undefined);
  }
}
