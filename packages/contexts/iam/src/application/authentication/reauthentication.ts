import { Result } from "@architecture/foundation";

import type { SecurityTokens } from "#accounts/security-effects";
import type { IamResult } from "#application-result";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import type { PasswordAuthenticatorRepository } from "#ports/password-authenticator.repository";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type { AuthenticationPolicyReader } from "./authentication-policy.reader.js";
import type { MfaCryptography, MfaStore } from "./mfa/mfa.ports.js";

export class FactorVerification {
  constructor(
    private readonly store: MfaStore,
    private readonly crypto: MfaCryptography,
    private readonly tokens: SecurityTokens,
  ) {}
  async verify(
    userId: string,
    code: string,
    challengeId?: string,
  ): Promise<IamResult<"totp" | "backup_code">> {
    const credential = await this.store.credential(userId);
    if (!credential?.enabledAt) {
      return Result.failure({ code: "MFA_NOT_ENABLED" } as const);
    }
    const normalized = code.replace(/[\s-]/g, "").toUpperCase();
    const counter = /^\d{6}$/.test(normalized)
      ? this.crypto.verifyTotp(
          this.crypto.open(credential.sealedSecret),
          normalized,
        )
      : null;
    const method = await this.store.verify({
      userId,
      sealedSecret: credential.sealedSecret,
      counter,
      backupHash: this.tokens.hash(normalized),
      now: new Date(),
      ...(challengeId ? { challengeId } : {}),
    });
    return method
      ? Result.success(method)
      : Result.failure({
          code: challengeId ? "MFA_CHALLENGE_INVALID" : "MFA_CODE_INVALID",
        } as const);
  }
}
/** Shared application checks for operations requiring fresh proof of account control. */
export class Reauthentication {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordAuthenticatorRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionRepository,
    private readonly policies: AuthenticationPolicyReader,
    private readonly mfa: MfaStore,
    private readonly factor: FactorVerification,
  ) {}
  async password(userId: string, password: string): Promise<IamResult<void>> {
    const id = UserIdentifierValueObject.create(userId),
      plain = PasswordPlainValueObject.create(password);
    if (!id.success || !plain.success) {
      return Result.failure({ code: "INVALID_CREDENTIALS" } as const);
    }
    const credential = await this.passwords.findForUser(id.value);
    if (
      !credential ||
      credential.isRevoked ||
      !(await this.hasher.verify(plain.value, credential.passwordHash))
    ) {
      return Result.failure({ code: "INVALID_CREDENTIALS" } as const);
    }
    return Result.success(undefined);
  }
  async recent(
    userId: string,
    sessionId: string,
    password: string,
    capturedPolicy?: import("#domain/security-policy").SecurityPolicy["authentication"],
  ): Promise<IamResult<number>> {
    const id = SessionIdentifierValueObject.create(sessionId),
      userIdentifier = UserIdentifierValueObject.create(userId);
    if (!id.success || !userIdentifier.success) {
      return Result.failure({
        code: "RECENT_AUTHENTICATION_REQUIRED",
      } as const);
    }
    const session = await this.sessions.findById(id.value),
      user = await this.users.findById(userIdentifier.value),
      policy =
        capturedPolicy ?? (await this.policies.getAuthenticationPolicy());
    if (
      !session ||
      !user ||
      !user.status.isActive() ||
      session.userId.value !== userId ||
      session.isExpired() ||
      session.userSessionVersion !== user.sessionVersion ||
      Date.now() - session.createdAt.getTime() >
        policy.recentAuthenticationMinutes * 60000
    ) {
      return Result.failure({
        code: "RECENT_AUTHENTICATION_REQUIRED",
      } as const);
    }
    const verified = await this.password(userId, password);
    return verified.success
      ? Result.success(session.userSessionVersion)
      : verified;
  }
  async strong(
    userId: string,
    sessionId: string,
    password: string,
    code?: string,
    capturedPolicy?: import("#domain/security-policy").SecurityPolicy["authentication"],
  ): Promise<IamResult<number>> {
    const recent = await this.recent(
      userId,
      sessionId,
      password,
      capturedPolicy,
    );
    if (!recent.success) {
      return recent;
    }
    if ((await this.mfa.credential(userId))?.enabledAt) {
      if (!code) {
        return Result.failure({ code: "MFA_CODE_REQUIRED" } as const);
      }
      const factor = await this.factor.verify(userId, code);
      if (!factor.success) {
        return factor;
      }
    }
    return Result.success(recent.value);
  }
}
