import type { PasswordPolicy } from "#domain/password-policy";

export type IamActorRole = "user" | "admin";

export type IamCapability =
  | "accounts.publicRegistration"
  | "accounts.emailVerification"
  | "accounts.emailChange"
  | "accounts.export"
  | "accounts.deletion"
  | "authentication.mfa"
  | "sessions.userManagement"
  | "recovery"
  | "audit.consultation";

export interface IamAccountIdentityPolicy {
  readonly allowedLoginIdentifiers: readonly ("username" | "email")[];
  readonly requireEmailVerification: boolean;
}

export interface IamPolicyProvider {
  getPasswordPolicy(role: IamActorRole): Promise<PasswordPolicy>;
  getAccountIdentityPolicy?(): Promise<IamAccountIdentityPolicy>;
  getSessionDurationMinutes(): Promise<number>;
  isCapabilityEnabled(capability: IamCapability): Promise<boolean>;
}
