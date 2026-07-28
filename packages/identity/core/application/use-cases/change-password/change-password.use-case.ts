// @file bounded-contexts/identity/application/use-cases/change-password/change-password.use-case.ts

import { Result } from "@architecture/foundation";

import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { PasswordHasher } from "#services/password-hasher.service";
import type { PasswordPolicyValidator } from "#services/password-policy-validator.service";
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
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionPort: SessionRepository,
    private readonly passwordPolicy: PasswordPolicyValidator,
    private readonly privilegedPasswordPolicy: PasswordPolicyValidator = passwordPolicy,
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

    const currentPassword = PasswordPlainValueObject.create(
      payload.currentPassword,
    );
    if (
      !currentPassword.success ||
      !(await this.passwordHasher.verify(currentPassword.value, user.password))
    ) {
      return Result.failure(ChangePasswordErrorsCodes.currentPasswordInvalid);
    }

    const activePolicy = user.role.isAdmin()
      ? this.privilegedPasswordPolicy
      : this.passwordPolicy;
    const validation = await activePolicy.validate({
      password: payload.password,
      confirmation: payload.passwordConfirmation,
      context: { email: user.email.value },
    });
    const firstValidationError = validation.errors[0];
    if (firstValidationError) {
      return Result.failure(firstValidationError);
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(password.error);
    }

    if (
      activePolicy.publicPolicy.rejectCurrentPassword &&
      (await this.passwordHasher.verify(password.value, user.password))
    ) {
      return Result.failure(ChangePasswordErrorsCodes.reused);
    }

    const hashed = await this.passwordHasher.hash(password.value);

    user.changePassword(hashed);

    await this.userPort.save(user);
    await this.sessionPort.deleteAllForUser(user.identifier);

    return Result.success(undefined);
  }
}
