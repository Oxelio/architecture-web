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

export interface IamPolicyProvider {
  getPasswordPolicy(role: IamActorRole): Promise<PasswordPolicy>;
  getSessionDurationMinutes(): Promise<number>;
  isCapabilityEnabled(capability: IamCapability): Promise<boolean>;
}
