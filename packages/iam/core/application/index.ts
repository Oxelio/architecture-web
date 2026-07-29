// @file bounded-contexts/iam/application/index.ts

// ============================================================
// Use Cases
// ============================================================

export type {
  ActivateUser,
  ActivateUserError,
  ActivateUserInput,
  ActivateUserOutput,
} from "./access-administration/use-cases/activate-user/activate-user.contracts.js";
export type {
  AssignUserRole,
  AssignUserRoleError,
  AssignUserRoleInput,
  AssignUserRoleOutput,
} from "./access-administration/use-cases/assign-user-role/assign-user-role.contracts.js";
export type {
  GetUserAdministrationOverview,
  GetUserAdministrationOverviewInput,
  GetUserAdministrationOverviewOutput,
  UserAdministrationOverview,
} from "./access-administration/use-cases/get-user-administration-overview/get-user-administration-overview.contracts.js";
export type {
  AdministeredUserSession,
  ListUserSessions,
  ListUserSessionsError,
  ListUserSessionsInput,
  ListUserSessionsOutput,
} from "./access-administration/use-cases/list-user-sessions/list-user-sessions.contracts.js";
export type {
  AdminUser,
  ListUsers,
  ListUsersError,
  ListUsersInput,
  ListUsersOutput,
  ListUsersResult,
  UserListPagination,
} from "./access-administration/use-cases/list-users/list-users.contracts.js";
export type {
  RevokeUserSession,
  RevokeUserSessionError,
  RevokeUserSessionInput,
  RevokeUserSessionOutput,
} from "./access-administration/use-cases/revoke-user-session/revoke-user-session.contracts.js";
export type {
  SuspendUser,
  SuspendUserError,
  SuspendUserInput,
  SuspendUserOutput,
} from "./access-administration/use-cases/suspend-user/suspend-user.contracts.js";
export type {
  ChangeEmail,
  ChangeEmailError,
  ChangeEmailInput,
  ChangeEmailOutput,
} from "./accounts/use-cases/change-email/change-email.contracts.js";
export type {
  ChangePassword,
  ChangePasswordError,
  ChangePasswordInput,
  ChangePasswordOutput,
} from "./accounts/use-cases/change-password/change-password.contracts.js";
export type {
  CurrentAccount,
  GetCurrentAccount,
  GetCurrentAccountError,
  GetCurrentAccountInput,
  GetCurrentAccountOutput,
} from "./accounts/use-cases/get-current-account/get-current-account.contracts.js";
export type {
  EvaluatePassword,
  EvaluatePasswordInput,
  GetPasswordPolicy,
  PasswordEvaluation,
  PublicPasswordPolicy,
} from "./accounts/use-cases/password-policy/password-policy.contracts.js";
export type {
  ResendEmailVerification,
  ResendEmailVerificationError,
  ResendEmailVerificationInput,
  ResendEmailVerificationOutput,
} from "./accounts/use-cases/resend-email-verification/resend-email-verification.contracts.js";
export type {
  SignUp,
  SignUpError,
  SignUpInput,
  SignUpOutput,
  UserRegistration,
} from "./accounts/use-cases/sign-up/sign-up.contracts.js";
export type {
  VerifyEmail,
  VerifyEmailError,
  VerifyEmailInput,
  VerifyEmailOutput,
} from "./accounts/use-cases/verify-email/verify-email.contracts.js";
export type {
  CurrentUserSession,
  ListCurrentUserSessions,
  ListCurrentUserSessionsError,
  ListCurrentUserSessionsInput,
  ListCurrentUserSessionsOutput,
} from "./authentication/use-cases/list-current-user-sessions/list-current-user-sessions.contracts.js";
export type {
  ResolveSession,
  ResolveSessionError,
  ResolveSessionInput,
  ResolveSessionOutput,
  SessionResolution,
} from "./authentication/use-cases/resolve-session/resolve-session.contracts.js";
export type {
  RevokeCurrentUserSession,
  RevokeCurrentUserSessionError,
  RevokeCurrentUserSessionInput,
  RevokeCurrentUserSessionOutput,
} from "./authentication/use-cases/revoke-current-user-session/revoke-current-user-session.contracts.js";
export type {
  AuthenticationSession,
  SignIn,
  SignInError,
  SignInInput,
  SignInOutput,
} from "./authentication/use-cases/sign-in/sign-in.contracts.js";
export type {
  SignOut,
  SignOutError,
  SignOutInput,
  SignOutOutput,
} from "./authentication/use-cases/sign-out/sign-out.contracts.js";

// ============================================================
// Factories
// ============================================================
export type { IamApplication, IamDependencies } from "./create-iam.js";
export { createIam } from "./create-iam.js";

// Ports
export { EmailVerificationRepository } from "./repositories/email-verification.repository.js";
export { SessionRepository } from "./repositories/session.repository.js";
export {
  UserRepository,
  type UserSearchCriteria,
  type UserSearchResult,
} from "./repositories/user.repository.js";
export {
  type AdministratorAuthorizationError,
  AdministratorAuthorizationErrorCodes,
  AdministratorAuthorizer,
} from "./services/administrator-authorizer.service.js";
export { EmailSender } from "./services/email-sender.service.js";
export { EmailVerificationRateLimiter } from "./services/email-verification-rate-limiter.service.js";
export { EmailVerificationTokenHasher } from "./services/email-verification-token-hasher.service.js";
export { PasswordHasher } from "./services/password-hasher.service.js";
export {
  PasswordPolicyValidator,
  type PasswordValidationError,
  type PasswordValidationResult,
} from "./services/password-policy-validator.service.js";
export {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  type PasswordContext,
  type PasswordPolicyProvider,
  PasswordStrengthEvaluator,
} from "./services/password-security.service.js";
export {
  type SecondFactorChallenge,
  SecondFactorGate,
} from "./services/second-factor-gate.service.js";
