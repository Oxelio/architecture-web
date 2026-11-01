import type { OutboxWriter } from "@architecture/messaging/application";

import type { PasswordPolicy } from "#domain/password-policy";
import {
  DEFAULT_SECURITY_POLICY,
  type SecurityPolicy,
} from "#domain/security-policy";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
export class TestPolicies {
  constructor(
    private readonly identifiers: readonly ("username" | "email")[] = [
      "username",
      "email",
    ],
    private readonly emailVerification = true,
  ) {}
  async getRegistrationPolicy() {
    return {
      accounts: await this.getAccountPolicy(),
      password: await this.get(),
    };
  }
  async getSignInPolicy() {
    return {
      accounts: await this.getAccountPolicy(),
      authentication: await this.getAuthenticationPolicy(),
      sessions: await this.getSessionPolicy(),
    };
  }
  async getAccountSecurityPolicy() {
    return {
      accounts: await this.getAccountPolicy(),
      authentication: await this.getAuthenticationPolicy(),
    };
  }
  getAccountPolicy(): Promise<SecurityPolicy["accounts"]> {
    return Promise.resolve({
      ...DEFAULT_SECURITY_POLICY.accounts,
      allowedLoginIdentifiers: [...this.identifiers],
      emailVerification: this.emailVerification,
    });
  }
  get(): Promise<PasswordPolicy> {
    return Promise.resolve({
      level: "standard" as const,
      minLength: 8,
      maxLength: 128,
      minimumStrength: "too_weak" as const,
      checkCommonPasswords: false,
      checkCompromisedPasswords: false,
      checkUserContext: false,
      composition: {
        requireUppercase: false,
        requireLowercase: false,
        requireNumber: false,
        requireSpecialCharacter: false,
      },
      rejectCurrentPassword: false,
    });
  }
  getSessionPolicy(): Promise<SecurityPolicy["sessions"]> {
    return Promise.resolve({
      ...DEFAULT_SECURITY_POLICY.sessions,
      durationMinutes: 60,
    });
  }
  getAuthenticationPolicy() {
    try {
      return Promise.resolve(
        structuredClone(DEFAULT_SECURITY_POLICY.authentication),
      );
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
export function testPasswordHash(value = "test-hash") {
  const result = PasswordHashValueObject.create(value);
  if (!result.success) {
    throw new Error("Invalid test password hash");
  }
  return result.value;
}
export const discardOutbox: OutboxWriter = {
  append: () => Promise.resolve(),
};
