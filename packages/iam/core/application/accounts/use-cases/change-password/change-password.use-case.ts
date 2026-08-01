// @file bounded-contexts/iam/application/use-cases/change-password/change-password.use-case.ts

import { Result } from "@architecture/foundation";

import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#repositories/password-authenticator.repository";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { PasswordHasher } from "#services/password-hasher.service";
import type { PasswordPolicyValidator } from "#services/password-policy-validator.service";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ChangePasswordErrorsCodes } from "./change-password.codes.js";
import type {
  ChangePassword,
  ChangePasswordInput,
  ChangePasswordOutput,
} from "./change-password.contracts.js";

export class ChangePasswordUseCase implements ChangePassword {
  constructor(
    private readonly userPort: UserRepository,
    private readonly loginIdentities: LoginIdentityRepository,
    private readonly passwordAuthenticators: PasswordAuthenticatorRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionPort: SessionRepository,
    private readonly passwordPolicy: PasswordPolicyValidator,
    private readonly privilegedPasswordPolicy: PasswordPolicyValidator = passwordPolicy,
    private readonly unitOfWork?: IamUnitOfWork,
  ) {}

  async execute(payload: ChangePasswordInput): Promise<ChangePasswordOutput> {
    const userId = UserIdentifierValueObject.create(payload.userId);
    if (!userId.success) {
      return Result.failure(ChangePasswordErrorsCodes.invalidId);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ChangePasswordErrorsCodes.notFound);
    }

    const authenticator = await this.passwordAuthenticators.findForUser(
      user.identifier,
    );
    if (!authenticator || authenticator.isRevoked) {
      return Result.failure(ChangePasswordErrorsCodes.currentPasswordInvalid);
    }

    const currentPassword = PasswordPlainValueObject.create(
      payload.currentPassword,
    );
    if (
      !currentPassword.success ||
      !(await this.passwordHasher.verify(
        currentPassword.value,
        authenticator.passwordHash,
      ))
    ) {
      return Result.failure(ChangePasswordErrorsCodes.currentPasswordInvalid);
    }

    const activePolicy = user.role.isAdmin()
      ? this.privilegedPasswordPolicy
      : this.passwordPolicy;
    const emailIdentity = await this.loginIdentities.findForUser(
      user.identifier,
      "email",
    );
    const validation = await activePolicy.validate({
      password: payload.password,
      confirmation: payload.passwordConfirmation,
      ...(emailIdentity
        ? { context: { email: emailIdentity.login.value } }
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

    const publicPolicy = await activePolicy.getPublicPolicy();
    if (
      publicPolicy.rejectCurrentPassword &&
      (await this.passwordHasher.verify(
        password.value,
        authenticator.passwordHash,
      ))
    ) {
      return Result.failure(ChangePasswordErrorsCodes.reused);
    }

    const hashed = await this.passwordHasher.hash(password.value);

    authenticator.changePassword(hashed);
    user.invalidateSessions();

    if (this.unitOfWork) {
      await this.unitOfWork.execute(
        async ({ passwordAuthenticators, users }) => {
          await passwordAuthenticators.save(authenticator);
          await users.save(user);
        },
      );
    } else {
      await this.passwordAuthenticators.save(authenticator);
      await this.userPort.save(user);
    }
    await this.sessionPort.deleteAllForUser(user.identifier);

    return Result.success(undefined);
  }
}
