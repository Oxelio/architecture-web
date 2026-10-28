// @file bounded-contexts/iam/application/index.ts

// ============================================================
// Use Cases
// ============================================================

export type {
  ActivateUser,
  ActivateUserError,
  ActivateUserInput,
  ActivateUserOutput,
} from "./access-administration/activate-user/activate-user.contracts.js";
export type {
  AssignUserRole,
  AssignUserRoleError,
  AssignUserRoleInput,
  AssignUserRoleOutput,
} from "./access-administration/assign-user-role/assign-user-role.contracts.js";
export type {
  GetUserAdministrationOverview,
  GetUserAdministrationOverviewInput,
  GetUserAdministrationOverviewOutput,
  UserAdministrationOverview,
} from "./access-administration/get-user-administration-overview/get-user-administration-overview.contracts.js";
export type {
  AdministeredUserSession,
  ListUserSessions,
  ListUserSessionsError,
  ListUserSessionsInput,
  ListUserSessionsOutput,
} from "./access-administration/list-user-sessions/list-user-sessions.contracts.js";
export type {
  AdminUser,
  ListUsers,
  ListUsersError,
  ListUsersInput,
  ListUsersOutput,
  ListUsersResult,
  UserListPagination,
} from "./access-administration/list-users/list-users.contracts.js";
export type {
  RevokeUserSession,
  RevokeUserSessionError,
  RevokeUserSessionInput,
  RevokeUserSessionOutput,
} from "./access-administration/revoke-user-session/revoke-user-session.contracts.js";
export type {
  SuspendUser,
  SuspendUserError,
  SuspendUserInput,
  SuspendUserOutput,
} from "./access-administration/suspend-user/suspend-user.contracts.js";
export type {
  ChangeEmail,
  ChangeEmailError,
  ChangeEmailInput,
  ChangeEmailOutput,
} from "./accounts/change-email/change-email.contracts.js";
export type {
  ChangePassword,
  ChangePasswordError,
  ChangePasswordInput,
  ChangePasswordOutput,
} from "./accounts/change-password/change-password.contracts.js";
export type {
  AccountLoginIdentifier,
  CurrentAccount,
  GetCurrentAccount,
  GetCurrentAccountError,
  GetCurrentAccountInput,
  GetCurrentAccountOutput,
} from "./accounts/get-current-account/get-current-account.contracts.js";
export type {
  EvaluatePassword,
  EvaluatePasswordInput,
  GetPasswordPolicy,
  PasswordEvaluation,
  PublicPasswordPolicy,
} from "./accounts/password-policy/password-policy.contracts.js";
export type {
  ResendEmailVerification,
  ResendEmailVerificationError,
  ResendEmailVerificationInput,
  ResendEmailVerificationOutput,
} from "./accounts/resend-email-verification/resend-email-verification.contracts.js";
export type {
  SignUp,
  SignUpError,
  SignUpInput,
  SignUpOutput,
  UserRegistration,
} from "./accounts/sign-up/sign-up.contracts.js";
export type {
  VerifyEmail,
  VerifyEmailError,
  VerifyEmailInput,
  VerifyEmailOutput,
} from "./accounts/verify-email/verify-email.contracts.js";
export type {
  CurrentUserSession,
  ListCurrentUserSessions,
  ListCurrentUserSessionsError,
  ListCurrentUserSessionsInput,
  ListCurrentUserSessionsOutput,
} from "./authentication/list-current-user-sessions/list-current-user-sessions.contracts.js";
export type {
  ResolveSession,
  ResolveSessionError,
  ResolveSessionInput,
  ResolveSessionOutput,
  SessionResolution,
} from "./authentication/resolve-session/resolve-session.contracts.js";
export type {
  RevokeCurrentUserSession,
  RevokeCurrentUserSessionError,
  RevokeCurrentUserSessionInput,
  RevokeCurrentUserSessionOutput,
} from "./authentication/revoke-current-user-session/revoke-current-user-session.contracts.js";
export type {
  AuthenticationSession,
  SignIn,
  SignInError,
  SignInInput,
  SignInOutput,
} from "./authentication/sign-in/sign-in.contracts.js";
export type {
  SignOut,
  SignOutError,
  SignOutInput,
  SignOutOutput,
} from "./authentication/sign-out/sign-out.contracts.js";

// ============================================================
// Factories
// ============================================================
export type { IamApplication, IamDependencies } from "./create-iam.js";
export { createIam } from "./create-iam.js";
export { toIamIntegrationEvent } from "./events/iam-integration-event.js";

// Ports
export {
  type AdministratorAuthorizationError,
  AdministratorAuthorizationErrorCodes,
  AdministratorAuthorizer,
} from "./access-administration/administrator-authorizer.js";
export type {
  ConfigurationRevision,
  ConfigurationStore,
  PublishedConfigurationReader,
} from "./access-administration/security-configuration/configuration.store.js";
export type {
  ConfigurationRevisionMetadata,
  StoredConfigurationRevision,
} from "./access-administration/security-configuration/configuration.store.js";
export { PublishedIamPolicies } from "./access-administration/security-configuration/published-iam-policies.js";
export * from "./access-administration/security-configuration/security-configuration.use-cases.js";
export type {
  AccountArchiveBuilder,
  AccountAuditData,
  AccountDeletionStore,
  AccountExportStore,
  AccountExportView,
  DeletionRequest,
} from "./accounts/account-data/account-data.ports.js";
export * from "./accounts/account-data/account-deletion.use-cases.js";
export * from "./accounts/account-data/account-export.use-cases.js";
export type { AccountPolicyReader } from "./accounts/account-policy.reader.js";
export type {
  AccountSecurityPolicyReader,
  RegistrationPolicyReader,
} from "./accounts/account-policy.reader.js";
export { EmailVerificationRateLimiter } from "./accounts/email-verification/email-verification-rate-limiter.port.js";
export { EmailVerificationTokenHasher } from "./accounts/email-verification/email-verification-token-hasher.port.js";
export { VerificationEmailSender } from "./accounts/email-verification/verification-email-sender.port.js";
export {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  type PasswordContext,
  PasswordStrengthEvaluator,
} from "./accounts/password-policy/password-checks.js";
export {
  FixedPasswordPolicyReader,
  type PasswordPolicyReader,
} from "./accounts/password-policy/password-policy.reader.js";
export {
  PasswordValidation,
  type PasswordValidationError,
  type PasswordValidationResult,
} from "./accounts/password-policy/password-validation.js";
export type {
  PasswordRecoveryStore,
  RecoveryCommit,
} from "./accounts/recovery/password-recovery.store.js";
export * from "./accounts/recovery/password-recovery.use-cases.js";
export type { RecoveryPolicyReader } from "./accounts/recovery/recovery-policy.reader.js";
export type {
  AccountSecurityMail,
  RecoveryOriginLimiter,
  SecurityContext,
  SecurityEventRecorder,
  SecurityTokens,
} from "./accounts/security-effects.js";
export type {
  AuthenticationPolicyReader,
  SessionPolicyReader,
} from "./authentication/authentication-policy.reader.js";
export type { SignInPolicyReader } from "./authentication/authentication-policy.reader.js";
export { IssueSession } from "./authentication/issue-session.js";
export { MAX_ACTIVE_SESSIONS_PER_USER } from "./authentication/issue-session.js";
export type {
  MfaCryptography,
  MfaStore,
} from "./authentication/mfa/mfa.ports.js";
export * from "./authentication/mfa/mfa.use-cases.js";
export { PasswordHasher } from "./authentication/password/password-hasher.port.js";
export {
  FactorVerification,
  Reauthentication,
} from "./authentication/reauthentication.js";
export type { SecondFactorChallenge } from "./authentication/sign-in/sign-in.contracts.js";
export {
  createIamSecurity,
  type IamResult,
  type IamSecurityApplication,
  type IamSecurityDependencies,
} from "./create-iam-security.js";
export { EmailVerificationRepository } from "./repositories/email-verification.repository.js";
export { LoginIdentityRepository } from "./repositories/login-identity.repository.js";
export { PasswordAuthenticatorRepository } from "./repositories/password-authenticator.repository.js";
export { SessionRepository } from "./repositories/session.repository.js";
export { UserRepository } from "./repositories/user.repository.js";
export {
  type UserAccountView,
  UserQueryRepository,
  type UserSearchCriteria,
  type UserSearchResult,
} from "./repositories/user-query.repository.js";
export {
  type IamTransactionalRepositories,
  IamUnitOfWork,
} from "./transactions/iam-unit-of-work.js";
export type { SecurityPolicy } from "#domain/security-policy";
export type { SessionClient, SessionNetwork } from "#entities/session.entity";
