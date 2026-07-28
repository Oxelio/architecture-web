// @file bounded-contexts/identity/domain/index.ts

export {
  comparePasswordStrength,
  createPasswordPolicy,
  type PasswordCompositionRules,
  type PasswordPolicy,
  type PasswordPolicyOverrides,
  type PasswordSecurityLevel,
  type PasswordStrength,
  PasswordStrengths,
} from "./password-policy.js";
export { EmailVerificationEntity } from "#entities/email-verification.entity";
export {
  type ApproximateSessionLocation,
  type SessionClient,
  type SessionClientType,
  type SessionDeviceType,
  SessionEntity,
  type SessionNetwork,
} from "#entities/session.entity";
export { UserEntity } from "#entities/user.entity";
export { EmailValueObject } from "#value-objects/email.value-object";
export { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
export { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
export { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
export { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
export { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
export { StatusValueObject } from "#value-objects/status.value-object";
export { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
export {
  type UserRole,
  UserRoleValueObject,
} from "#value-objects/user-role.value-object";
