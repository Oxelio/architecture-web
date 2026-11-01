import { Result } from "@architecture/foundation";

import type { PasswordPolicyReader } from "#accounts/password-policy/password-policy.reader";
import type { PasswordValidation } from "#accounts/password-policy/password-validation";
import type { PasswordRecoveryStore } from "#accounts/recovery/password-recovery.store";
import type { SecurityTokens } from "#accounts/security-effects";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import { selectPasswordPolicyProfile } from "#domain/password-policy";
import { isRecoveryTokenUsable } from "#domain/recovery-token";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#ports/password-authenticator.repository";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  type ResetRecoveredPassword,
  ResetRecoveredPasswordErrors,
  type ResetRecoveredPasswordInput,
  type ResetRecoveredPasswordOutput,
} from "./reset-recovered-password.contracts.js";

export class ResetRecoveredPasswordUseCase implements ResetRecoveredPassword {
  constructor(
    private readonly store: PasswordRecoveryStore,
    private readonly users: UserRepository,
    private readonly authenticators: PasswordAuthenticatorRepository,
    private readonly identities: LoginIdentityRepository,
    private readonly policies: PasswordPolicyReader,
    private readonly validation: Pick<PasswordValidation, "validate">,
    private readonly hasher: PasswordHasher,
    private readonly tokens: SecurityTokens,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(
    input: ResetRecoveredPasswordInput,
  ): Promise<ResetRecoveredPasswordOutput> {
    const invalid = () =>
      Result.failure(ResetRecoveredPasswordErrors.invalidToken);
    if (input.password !== input.passwordConfirmation) {
      return Result.failure(ResetRecoveredPasswordErrors.confirmationMismatch);
    }
    const tokenHash = this.tokens.hash(input.token),
      now = new Date();
    const recovery = await this.store.find(tokenHash);
    if (!recovery || !isRecoveryTokenUsable(recovery, now)) {
      return invalid();
    }
    const id = UserIdentifierValueObject.create(recovery.userId);
    if (!id.success) {
      return invalid();
    }
    const user = await this.users.findById(id.value),
      authenticator = await this.authenticators.findForUser(id.value);
    if (
      !user ||
      !authenticator ||
      authenticator.isRevoked ||
      user.status.value === "pending_deletion"
    ) {
      return invalid();
    }
    const policy = await this.policies.get(
      selectPasswordPolicyProfile(user.role),
    );
    const identities = await this.identities.listForUser(user.identifier);
    const context = Object.fromEntries(
      identities.map((identity) => [identity.login.kind, identity.login.value]),
    );
    const validation = await this.validation.validate(policy, {
      password: input.password,
      confirmation: input.passwordConfirmation,
      context,
    });
    if (validation.errors[0]) {
      return Result.failure(validation.errors[0]);
    }
    const plain = PasswordPlainValueObject.create(input.password);
    if (!plain.success) {
      return Result.failure(plain.error);
    }
    if (
      policy.rejectCurrentPassword &&
      (await this.hasher.verify(plain.value, authenticator.passwordHash))
    ) {
      return Result.failure(ResetRecoveredPasswordErrors.reused);
    }
    const hash = await this.hasher.hash(plain.value);
    const result = await this.store.withUsableToken(
      tokenHash,
      new Date(),
      async (commit) => {
        if (
          !commit.user.role.equals(user.role) ||
          commit.user.status.value === "pending_deletion" ||
          !commit.authenticator.passwordHash.equals(authenticator.passwordHash)
        ) {
          return invalid();
        }
        await commit.consume();
        commit.authenticator.changePassword(hash);
        commit.user.invalidateSessions();
        await commit.passwordAuthenticators.save(commit.authenticator);
        await commit.users.save(commit.user);
        return Result.success(undefined);
      },
    );
    if (!result?.success) {
      return result ?? invalid();
    }
    await this.sessions.deleteAllForUser(user.identifier);
    return result;
  }
}
