import { Result } from "@architecture/foundation";

import type { PasswordPolicyReader } from "#accounts/password-policy/password-policy.reader";
import type { PasswordValidation } from "#accounts/password-policy/password-validation";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import { selectPasswordPolicyProfile } from "#domain/password-policy";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#ports/password-authenticator.repository";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  ChangePassword,
  ChangePasswordInput,
  ChangePasswordOutput,
} from "./change-password.contracts.js";
import { ChangePasswordErrors } from "./change-password.errors.js";

export class ChangePasswordUseCase implements ChangePassword {
  constructor(
    private readonly userPort: UserRepository,
    private readonly loginIdentities: LoginIdentityRepository,
    private readonly passwordAuthenticators: PasswordAuthenticatorRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionPort: SessionRepository,
    private readonly policies: PasswordPolicyReader,
    private readonly passwordValidation: PasswordValidation,
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(payload: ChangePasswordInput): Promise<ChangePasswordOutput> {
    const userId = UserIdentifierValueObject.create(payload.userId);
    if (!userId.success) {
      return Result.failure(ChangePasswordErrors.invalidId);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ChangePasswordErrors.notFound);
    }

    const authenticator = await this.passwordAuthenticators.findForUser(
      user.identifier,
    );
    if (!authenticator || authenticator.isRevoked) {
      return Result.failure(ChangePasswordErrors.currentPasswordInvalid);
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
      return Result.failure(ChangePasswordErrors.currentPasswordInvalid);
    }

    const policy = await this.policies.get(
      selectPasswordPolicyProfile(user.role),
    );
    const emailIdentity = await this.loginIdentities.findForUser(
      user.identifier,
      "email",
    );
    const validation = await this.passwordValidation.validate(policy, {
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

    if (
      policy.rejectCurrentPassword &&
      (await this.passwordHasher.verify(
        password.value,
        authenticator.passwordHash,
      ))
    ) {
      return Result.failure(ChangePasswordErrors.reused);
    }

    const hashed = await this.passwordHasher.hash(password.value);

    const committed = await this.unitOfWork.executeForUser(
      user.identifier,
      async ({ passwordAuthenticators, users }) => {
        const currentUser = await users.findById(user.identifier);
        const currentAuthenticator = await passwordAuthenticators.findForUser(
          user.identifier,
        );
        if (
          !currentUser ||
          !currentAuthenticator ||
          currentAuthenticator.isRevoked ||
          !currentUser.role.equals(user.role) ||
          !currentAuthenticator.passwordHash.equals(authenticator.passwordHash)
        ) {
          return Result.failure(ChangePasswordErrors.currentPasswordInvalid);
        }
        currentAuthenticator.changePassword(hashed);
        currentUser.invalidateSessions();
        await passwordAuthenticators.save(currentAuthenticator);
        await users.save(currentUser);
        return Result.success(undefined);
      },
    );
    if (!committed.success) {
      return committed;
    }
    await this.sessionPort.deleteAllForUser(user.identifier);

    return Result.success(undefined);
  }
}
