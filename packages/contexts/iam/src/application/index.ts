// ============================================================
// Operation contracts and associated types
// ============================================================

// accounts
export type {
  CancelAccountDeletion,
  CancelAccountDeletionError,
  CancelAccountDeletionInput,
  CancelAccountDeletionOutput,
} from "./accounts/cancel-account-deletion/cancel-account-deletion.contracts.js";
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
  DownloadAccountExport,
  DownloadAccountExportError,
  DownloadAccountExportInput,
  DownloadAccountExportOutput,
} from "./accounts/download-account-export/download-account-export.contracts.js";
export type {
  AccountLoginIdentifier,
  CurrentAccount,
  GetCurrentAccount,
  GetCurrentAccountError,
  GetCurrentAccountInput,
  GetCurrentAccountOutput,
} from "./accounts/get-current-account/get-current-account.contracts.js";
export type {
  ListAccountExports,
  ListAccountExportsError,
  ListAccountExportsInput,
  ListAccountExportsOutput,
} from "./accounts/list-account-exports/list-account-exports.contracts.js";
export type {
  MaintainIamAccounts,
  MaintainIamAccountsError,
  MaintainIamAccountsOutput,
} from "./accounts/maintain-iam-accounts/maintain-iam-accounts.contracts.js";
export type { PasswordContext } from "./accounts/password-policy/password-checks.js";
export type {
  EvaluatePassword,
  EvaluatePasswordInput,
  GetPasswordPolicy,
  PasswordEvaluation,
  PublicPasswordPolicy,
} from "./accounts/password-policy/password-policy.contracts.js";
export type {
  PasswordValidationError,
  PasswordValidationResult,
} from "./accounts/password-policy/password-validation.js";
export type {
  RequestAccountDeletion,
  RequestAccountDeletionError,
  RequestAccountDeletionInput,
  RequestAccountDeletionOutput,
} from "./accounts/request-account-deletion/request-account-deletion.contracts.js";
export type {
  RequestAccountExport,
  RequestAccountExportError,
  RequestAccountExportInput,
  RequestAccountExportOutput,
} from "./accounts/request-account-export/request-account-export.contracts.js";
export type {
  RequestPasswordRecovery,
  RequestPasswordRecoveryError,
  RequestPasswordRecoveryInput,
  RequestPasswordRecoveryOutput,
} from "./accounts/request-password-recovery/request-password-recovery.contracts.js";
export type {
  ResendEmailVerification,
  ResendEmailVerificationError,
  ResendEmailVerificationInput,
  ResendEmailVerificationOutput,
} from "./accounts/resend-email-verification/resend-email-verification.contracts.js";
export type {
  ResetRecoveredPassword,
  ResetRecoveredPasswordError,
  ResetRecoveredPasswordInput,
  ResetRecoveredPasswordOutput,
} from "./accounts/reset-recovered-password/reset-recovered-password.contracts.js";
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
// authentication
export type {
  ActivateMfa,
  ActivateMfaError,
  ActivateMfaInput,
  ActivateMfaOutput,
} from "./authentication/activate-mfa/activate-mfa.contracts.js";
export type {
  BeginMfaEnrollment,
  BeginMfaEnrollmentError,
  BeginMfaEnrollmentInput,
  BeginMfaEnrollmentOutput,
} from "./authentication/begin-mfa-enrollment/begin-mfa-enrollment.contracts.js";
export type {
  BeginSecondFactor,
  BeginSecondFactorError,
  BeginSecondFactorInput,
  BeginSecondFactorOutput,
} from "./authentication/begin-second-factor/begin-second-factor.contracts.js";
export type {
  CompleteMfaSignIn,
  CompleteMfaSignInError,
  CompleteMfaSignInInput,
  CompleteMfaSignInOutput,
} from "./authentication/complete-mfa-sign-in/complete-mfa-sign-in.contracts.js";
export type {
  ConfirmMfaEnrollment,
  ConfirmMfaEnrollmentError,
  ConfirmMfaEnrollmentInput,
  ConfirmMfaEnrollmentOutput,
} from "./authentication/confirm-mfa-enrollment/confirm-mfa-enrollment.contracts.js";
export type {
  DisableMfa,
  DisableMfaError,
  DisableMfaInput,
  DisableMfaOutput,
} from "./authentication/disable-mfa/disable-mfa.contracts.js";
export type {
  GetMfaStatus,
  GetMfaStatusError,
  GetMfaStatusInput,
  GetMfaStatusOutput,
} from "./authentication/get-mfa-status/get-mfa-status.contracts.js";
export type {
  CurrentUserSession,
  ListCurrentUserSessions,
  ListCurrentUserSessionsError,
  ListCurrentUserSessionsInput,
  ListCurrentUserSessionsOutput,
} from "./authentication/list-current-user-sessions/list-current-user-sessions.contracts.js";
export type {
  FactorVerificationError,
  PasswordAuthenticationError,
  RecentAuthenticationError,
  StrongAuthenticationError,
} from "./authentication/reauthentication.contracts.js";
export type {
  RegenerateMfaBackupCodes,
  RegenerateMfaBackupCodesError,
  RegenerateMfaBackupCodesInput,
  RegenerateMfaBackupCodesOutput,
} from "./authentication/regenerate-mfa-backup-codes/regenerate-mfa-backup-codes.contracts.js";
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
  SecondFactorChallenge,
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
// access-administration
export type {
  ActivateUser,
  ActivateUserError,
  ActivateUserInput,
  ActivateUserOutput,
} from "./access-administration/activate-user/activate-user.contracts.js";
export {
  type AdministratorAuthorizationError,
  AdministratorAuthorizationErrors,
} from "./access-administration/administrator-authorizer.js";
export type {
  AssignUserRole,
  AssignUserRoleError,
  AssignUserRoleInput,
  AssignUserRoleOutput,
} from "./access-administration/assign-user-role/assign-user-role.contracts.js";
export type {
  GetIamCapabilities,
  GetIamCapabilitiesError,
  GetIamCapabilitiesOutput,
} from "./access-administration/get-iam-capabilities/get-iam-capabilities.contracts.js";
export type {
  GetSecurityConfiguration,
  GetSecurityConfigurationError,
  GetSecurityConfigurationInput,
  GetSecurityConfigurationOutput,
} from "./access-administration/get-security-configuration/get-security-configuration.contracts.js";
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
  UserList,
  UserListPagination,
} from "./access-administration/list-users/list-users.contracts.js";
export type {
  PreviewSecurityConfiguration,
  PreviewSecurityConfigurationError,
  PreviewSecurityConfigurationInput,
  PreviewSecurityConfigurationOutput,
} from "./access-administration/preview-security-configuration/preview-security-configuration.contracts.js";
export type {
  PublishSecurityConfiguration,
  PublishSecurityConfigurationError,
  PublishSecurityConfigurationInput,
  PublishSecurityConfigurationOutput,
} from "./access-administration/publish-security-configuration/publish-security-configuration.contracts.js";
export type {
  RestoreSecurityConfiguration,
  RestoreSecurityConfigurationError,
  RestoreSecurityConfigurationInput,
  RestoreSecurityConfigurationOutput,
} from "./access-administration/restore-security-configuration/restore-security-configuration.contracts.js";
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
export type { SecurityPolicy } from "#domain/security-policy";
export type { SessionClient, SessionNetwork } from "#entities/session.entity";

// ============================================================
// Ports and supporting types
// ============================================================

export type {
  ConfigurationRevision,
  ConfigurationRevisionMetadata,
  ConfigurationStore,
  PublishedConfigurationReader,
  StoredConfigurationRevision,
} from "./access-administration/security-configuration/configuration.store.js";
export type {
  AccountArchiveBuilder,
  AccountAuditData,
  AccountDeletionStore,
  AccountExportStore,
  AccountExportView,
  DeletionRequest,
} from "./accounts/account-data/account-data.ports.js";
export type {
  AccountPolicyReader,
  AccountSecurityPolicyReader,
  RegistrationPolicyReader,
} from "./accounts/account-policy.reader.js";
export { EmailVerificationRateLimiter } from "./accounts/email-verification/email-verification-rate-limiter.port.js";
export { EmailVerificationTokenHasher } from "./accounts/email-verification/email-verification-token-hasher.port.js";
export { VerificationEmailSender } from "./accounts/email-verification/verification-email-sender.port.js";
export type { PasswordPolicyReader } from "./accounts/password-policy/password-policy.reader.js";
export type {
  PasswordRecoveryStore,
  RecoveryCommit,
} from "./accounts/recovery/password-recovery.store.js";
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
  SignInPolicyReader,
} from "./authentication/authentication-policy.reader.js";
export type {
  MfaCryptography,
  MfaStore,
} from "./authentication/mfa/mfa.ports.js";
export { PasswordHasher } from "./authentication/password/password-hasher.port.js";
export { EmailVerificationRepository } from "./ports/email-verification.repository.js";
export {
  type IamTransactionalRepositories,
  IamUnitOfWork,
} from "./ports/iam-unit-of-work.js";
export { LoginIdentityRepository } from "./ports/login-identity.repository.js";
export { PasswordAuthenticatorRepository } from "./ports/password-authenticator.repository.js";
export { SessionRepository } from "./ports/session.repository.js";
export { UserRepository } from "./ports/user.repository.js";
export {
  type UserAccountView,
  UserQueryRepository,
  type UserSearchCriteria,
  type UserSearchResult,
} from "./ports/user-query.repository.js";

// ============================================================
// Composition
// ============================================================

export type { AdministrationApplication } from "./access-administration/access-administration.application.js";
export type { AccountsApplication } from "./accounts/accounts.application.js";
export type { AuthenticationApplication } from "./authentication/authentication.application.js";
export {
  createIam,
  type IamApplication,
  type IamDependencies,
} from "./create-iam.js";

// ============================================================
// Public implementations and utilities
// ============================================================

export { AdministratorAuthorizer } from "./access-administration/administrator-authorizer.js";
export { GetIamCapabilitiesUseCase } from "./access-administration/get-iam-capabilities/get-iam-capabilities.use-case.js";
export { GetSecurityConfigurationUseCase } from "./access-administration/get-security-configuration/get-security-configuration.use-case.js";
export { PreviewSecurityConfigurationUseCase } from "./access-administration/preview-security-configuration/preview-security-configuration.use-case.js";
export { PublishSecurityConfigurationUseCase } from "./access-administration/publish-security-configuration/publish-security-configuration.use-case.js";
export { RestoreSecurityConfigurationUseCase } from "./access-administration/restore-security-configuration/restore-security-configuration.use-case.js";
export { PublishedIamPolicies } from "./access-administration/security-configuration/published-iam-policies.js";
export { CancelAccountDeletionUseCase } from "./accounts/cancel-account-deletion/cancel-account-deletion.use-case.js";
export { DownloadAccountExportUseCase } from "./accounts/download-account-export/download-account-export.use-case.js";
export { ListAccountExportsUseCase } from "./accounts/list-account-exports/list-account-exports.use-case.js";
export { MaintainIamAccountsUseCase } from "./accounts/maintain-iam-accounts/maintain-iam-accounts.use-case.js";
export {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  PasswordStrengthEvaluator,
} from "./accounts/password-policy/password-checks.js";
export { FixedPasswordPolicyReader } from "./accounts/password-policy/password-policy.reader.js";
export { PasswordValidation } from "./accounts/password-policy/password-validation.js";
export { RequestAccountDeletionUseCase } from "./accounts/request-account-deletion/request-account-deletion.use-case.js";
export { RequestAccountExportUseCase } from "./accounts/request-account-export/request-account-export.use-case.js";
export { RequestPasswordRecoveryUseCase } from "./accounts/request-password-recovery/request-password-recovery.use-case.js";
export { ResetRecoveredPasswordUseCase } from "./accounts/reset-recovered-password/reset-recovered-password.use-case.js";
export { ActivateMfaUseCase } from "./authentication/activate-mfa/activate-mfa.use-case.js";
export { BeginMfaEnrollmentUseCase } from "./authentication/begin-mfa-enrollment/begin-mfa-enrollment.use-case.js";
export { BeginSecondFactorUseCase } from "./authentication/begin-second-factor/begin-second-factor.use-case.js";
export { CompleteMfaSignInUseCase } from "./authentication/complete-mfa-sign-in/complete-mfa-sign-in.use-case.js";
export { ConfirmMfaEnrollmentUseCase } from "./authentication/confirm-mfa-enrollment/confirm-mfa-enrollment.use-case.js";
export { DisableMfaUseCase } from "./authentication/disable-mfa/disable-mfa.use-case.js";
export { GetMfaStatusUseCase } from "./authentication/get-mfa-status/get-mfa-status.use-case.js";
export {
  IssueSession,
  MAX_ACTIVE_SESSIONS_PER_USER,
} from "./authentication/issue-session.js";
export {
  FactorVerification,
  Reauthentication,
} from "./authentication/reauthentication.js";
export { RegenerateMfaBackupCodesUseCase } from "./authentication/regenerate-mfa-backup-codes/regenerate-mfa-backup-codes.use-case.js";
export { toIamIntegrationEvent } from "./events/iam-integration-event.js";
export {
  createIamSecurityEvent,
  type IamSecurityEventInput,
} from "./events/iam-security-event.js";
