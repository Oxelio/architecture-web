// @file bounded-contexts/identity/application/index.ts

// ============================================================
// Use Cases
// ============================================================

export type {
  ActivateUserError,
  ActivateUserInput,
  ActivateUserOutput,
  ActivateUserSuccess,
} from "./use-cases/activate-user/activate-user.types.js";
export { ActivateUserUseCase } from "./use-cases/activate-user/activate-user.use-case.js";
export type {
  ChangeEmailError,
  ChangeEmailInput,
  ChangeEmailOutput,
  ChangeEmailSuccess,
} from "./use-cases/change-email/change-email.types.js";
export { ChangeEmailUseCase } from "./use-cases/change-email/change-email.use-case.js";
export type {
  ChangePasswordError,
  ChangePasswordInput,
  ChangePasswordOutput,
  ChangePasswordSuccess,
} from "./use-cases/change-password/change-password.types.js";
export { ChangePasswordUseCase } from "./use-cases/change-password/change-password.use-case.js";
export type {
  GetUserProfileError,
  GetUserProfileInput,
  GetUserProfileOutput,
  GetUserProfileSuccess,
  UserProfile,
} from "./use-cases/get-user-profile/get-user-profile.types.js";
export { GetUserProfileUseCase } from "./use-cases/get-user-profile/get-user-profile.use-case.js";
export type {
  ResendEmailVerificationError,
  ResendEmailVerificationInput,
  ResendEmailVerificationOutput,
  ResendEmailVerificationSuccess,
} from "./use-cases/resend-email-verification/resend-email-verification.types.js";
export { ResendEmailVerificationUseCase } from "./use-cases/resend-email-verification/resend-email-verification.use-case.js";
export type {
  ResolveSessionError,
  ResolveSessionInput,
  ResolveSessionOutput,
  ResolveSessionSuccess,
  SessionResolution,
} from "./use-cases/resolve-session/resolve-session.types.js";
export { ResolveSessionUseCase } from "./use-cases/resolve-session/resolve-session.use-case.js";
export type {
  AuthenticationSession,
  SignInError,
  SignInInput,
  SignInOutput,
  SignInSuccess,
} from "./use-cases/sign-in/sign-in.types.js";
export { SignInUseCase } from "./use-cases/sign-in/sign-in.use-case.js";
export type {
  SignOutError,
  SignOutInput,
  SignOutOutput,
  SignOutSuccess,
} from "./use-cases/sign-out/sign-out.types.js";
export { SignOutUseCase } from "./use-cases/sign-out/sign-out.use-case.js";
export type {
  SignUpError,
  SignUpInput,
  SignUpOutput,
  SignUpSuccess,
  UserRegistration,
} from "./use-cases/sign-up/sign-up.types.js";
export { SignUpUseCase } from "./use-cases/sign-up/sign-up.use-case.js";
export type {
  SuspendUserError,
  SuspendUserInput,
  SuspendUserOutput,
  SuspendUserSuccess,
} from "./use-cases/suspend-user/suspend-user.types.js";
export { SuspendUserUseCase } from "./use-cases/suspend-user/suspend-user.use-case.js";
export type {
  VerifyEmailError,
  VerifyEmailInput,
  VerifyEmailOutput,
  VerifyEmailSuccess,
} from "./use-cases/verify-email/verify-email.types.js";
export { VerifyEmailUseCase } from "./use-cases/verify-email/verify-email.use-case.js";

// ============================================================
// Ports
// ============================================================

export { EmailSenderPort } from "./ports/email-sender.port.js";
export type { EmailVerificationRecord } from "./ports/email-verification.port.js";
export { EmailVerificationPort } from "./ports/email-verification.port.js";
export { EmailVerificationRateLimitPort } from "./ports/email-verification-rate-limit.port.js";
export { PasswordHasherPort } from "./ports/password-hasher.port.js";
export { SessionPort } from "./ports/session.port.js";
export { UserPort } from "./ports/user.port.js";
