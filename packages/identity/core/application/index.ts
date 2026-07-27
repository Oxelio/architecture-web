// @file bounded-contexts/identity/application/index.ts

// ============================================================
// Use Cases
// ============================================================

export type {
  ActivateUser,
  ActivateUserError,
  ActivateUserInput,
  ActivateUserOutput,
} from "./use-cases/activate-user/activate-user.contracts.js";
export type {
  AssignUserRole,
  AssignUserRoleError,
  AssignUserRoleInput,
  AssignUserRoleOutput,
} from "./use-cases/assign-user-role/assign-user-role.contracts.js";
export { AssignUserRoleUseCase } from "./use-cases/assign-user-role/assign-user-role.use-case.js";
export type {
  ChangeEmail,
  ChangeEmailError,
  ChangeEmailInput,
  ChangeEmailOutput,
} from "./use-cases/change-email/change-email.contracts.js";
export type {
  ChangePassword,
  ChangePasswordError,
  ChangePasswordInput,
  ChangePasswordOutput,
} from "./use-cases/change-password/change-password.contracts.js";
export type {
  GetUserProfile,
  GetUserProfileError,
  GetUserProfileInput,
  GetUserProfileOutput,
  UserProfile,
} from "./use-cases/get-user-profile/get-user-profile.contracts.js";
export type {
  AdminSession,
  ListUserSessions,
  ListUserSessionsError,
  ListUserSessionsInput,
  ListUserSessionsOutput,
} from "./use-cases/list-user-sessions/list-user-sessions.contracts.js";
export type {
  AdminUser,
  ListUsers,
  ListUsersOutput,
} from "./use-cases/list-users/list-users.contracts.js";
export type {
  ResendEmailVerification,
  ResendEmailVerificationError,
  ResendEmailVerificationInput,
  ResendEmailVerificationOutput,
} from "./use-cases/resend-email-verification/resend-email-verification.contracts.js";
export type {
  ResolveSession,
  ResolveSessionError,
  ResolveSessionInput,
  ResolveSessionOutput,
  SessionResolution,
} from "./use-cases/resolve-session/resolve-session.contracts.js";
export type {
  RevokeUserSession,
  RevokeUserSessionError,
  RevokeUserSessionInput,
  RevokeUserSessionOutput,
} from "./use-cases/revoke-user-session/revoke-user-session.contracts.js";
export type {
  AuthenticationSession,
  SignIn,
  SignInError,
  SignInInput,
  SignInOutput,
} from "./use-cases/sign-in/sign-in.contracts.js";
export type {
  SignOut,
  SignOutError,
  SignOutInput,
  SignOutOutput,
} from "./use-cases/sign-out/sign-out.contracts.js";
export type {
  SignUp,
  SignUpError,
  SignUpInput,
  SignUpOutput,
  UserRegistration,
} from "./use-cases/sign-up/sign-up.contracts.js";
export type {
  SuspendUser,
  SuspendUserError,
  SuspendUserInput,
  SuspendUserOutput,
} from "./use-cases/suspend-user/suspend-user.contracts.js";
export type {
  VerifyEmail,
  VerifyEmailError,
  VerifyEmailInput,
  VerifyEmailOutput,
} from "./use-cases/verify-email/verify-email.contracts.js";

// ============================================================
// Factories
// ============================================================
export type {
  IdentityApplication,
  IdentityDependencies,
} from "./create-identity.js";
export { createIdentity } from "./create-identity.js";

// Ports
export { EmailVerificationRepository } from "./repositories/email-verification.repository.js";
export {
  SessionAdministrationRepository,
  SessionRepository,
} from "./repositories/session.repository.js";
export {
  UserAdministrationRepository,
  UserRepository,
} from "./repositories/user.repository.js";
export { EmailSender } from "./services/email-sender.service.js";
export { EmailVerificationRateLimiter } from "./services/email-verification-rate-limiter.service.js";
export { EmailVerificationTokenHasher } from "./services/email-verification-token-hasher.service.js";
export { PasswordHasher } from "./services/password-hasher.service.js";
