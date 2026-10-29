import type { AccountPolicyReader } from "#accounts/account-policy.reader";
import type { PasswordPolicyReader } from "#accounts/password-policy/password-policy.reader";
import type { RecoveryPolicyReader } from "#accounts/recovery/recovery-policy.reader";
import type {
  AuthenticationPolicyReader,
  SessionPolicyReader,
} from "#authentication/authentication-policy.reader";
import {
  createPasswordPolicy,
  type PasswordPolicyProfile,
} from "#domain/password-policy";

import type { PublishedConfigurationReader } from "./configuration.store.js";
/** Projects one complete published revision per read, without a process-local cache. */
export class PublishedIamPolicies
  implements
    PasswordPolicyReader,
    AccountPolicyReader,
    AuthenticationPolicyReader,
    SessionPolicyReader,
    RecoveryPolicyReader
{
  constructor(private readonly published: PublishedConfigurationReader) {}
  async get(profile: PasswordPolicyProfile) {
    return this.passwordPolicy(
      (await this.published.readPublished()).values.passwords,
      profile,
    );
  }
  private passwordPolicy(
    p: import("#domain/security-policy").SecurityPolicy["passwords"],
    profile: PasswordPolicyProfile,
  ) {
    const privileged = profile === "privileged";
    return createPasswordPolicy(
      privileged ? p.privilegedLevel : p.standardLevel,
      {
        minLength: privileged ? p.privilegedMinLength : p.standardMinLength,
        maxLength: p.maxLength,
        minimumStrength: privileged
          ? p.privilegedMinimumStrength
          : p.standardMinimumStrength,
        checkCommonPasswords: p.checkCommonPasswords,
        checkCompromisedPasswords: p.checkCompromisedPasswords,
        checkUserContext: p.checkUserContext,
        rejectCurrentPassword: p.rejectCurrentPassword,
        composition: {
          requireUppercase: p.requireUppercase,
          requireLowercase: p.requireLowercase,
          requireNumber: p.requireNumber,
          requireSpecialCharacter: p.requireSpecialCharacter,
        },
      },
    );
  }
  async getRegistrationPolicy() {
    const { values } = await this.published.readPublished();
    return {
      accounts: values.accounts,
      password: this.passwordPolicy(values.passwords, "standard"),
    };
  }
  async getSignInPolicy() {
    const { accounts, authentication, sessions } = (
      await this.published.readPublished()
    ).values;
    return { accounts, authentication, sessions };
  }
  async getAccountSecurityPolicy() {
    const { accounts, authentication } = (await this.published.readPublished())
      .values;
    return { accounts, authentication };
  }
  async getAccountPolicy() {
    return (await this.published.readPublished()).values.accounts;
  }
  async getAuthenticationPolicy() {
    return (await this.published.readPublished()).values.authentication;
  }
  async getSessionPolicy() {
    return (await this.published.readPublished()).values.sessions;
  }
  async getRecoveryPolicy() {
    return (await this.published.readPublished()).values.recovery;
  }
}
