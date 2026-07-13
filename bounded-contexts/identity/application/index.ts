// @file bounded-contexts/identity/application/index.ts

// Use Cases
export {
  type ResolveSessionError,
  type ResolveSessionInput,
  type ResolveSessionResponse,
  type ResolveSessionResult,
  ResolveSessionUseCase,
} from "./use-cases/resolve-session.use-case.js";
export {
  type ActivateUserCommand,
  type ActivateUserError,
  type ActivateUserResult,
  ActivateUserUseCase,
} from "#use-cases/activate-user.use-case";
export {
  type ChangeEmailError,
  type ChangeEmailInput,
  type ChangeEmailResult,
  ChangeEmailUseCase,
} from "#use-cases/change-email.use-case";
export {
  type ChangePasswordError,
  type ChangePasswordInput,
  type ChangePasswordResult,
  ChangePasswordUseCase,
} from "#use-cases/change-password.use-case";
export {
  type GetUserProfileError,
  type GetUserProfileInput,
  type GetUserProfileResponse,
  type GetUserProfileResult,
  GetUserProfileUseCase,
} from "#use-cases/get-user-profile.use-case";
export {
  type ResendEmailVerificationError,
  type ResendEmailVerificationInput,
  type ResendEmailVerificationResult,
  ResendEmailVerificationUseCase,
} from "#use-cases/resend-email-verification.use-case";
export {
  type SignInError,
  type SignInInput,
  type SignInResponse,
  type SignInResult,
  SignInUseCase,
} from "#use-cases/sign-in.use-case";
export {
  type SignOutInput,
  type SignOutResult,
  SignOutUseCase,
} from "#use-cases/sign-out.use-case";
export {
  type SignUpError,
  type SignUpInput,
  type SignUpResponse,
  type SignUpResult,
  SignUpUseCase,
} from "#use-cases/sign-up.use-case";
export {
  type SuspendUserError,
  type SuspendUserInput,
  type SuspendUserResult,
  SuspendUserUseCase,
} from "#use-cases/suspend-user.use-case";
export {
  type VerifyEmailError,
  type VerifyEmailInput,
  type VerifyEmailResult,
  VerifyEmailUseCase,
} from "#use-cases/verify-email.use-case";

// Ports
export { EmailSenderPort } from "./ports/email-sender.port.js";
export type { EmailVerificationRecord } from "./ports/email-verification.port.js";
export { EmailVerificationPort } from "./ports/email-verification.port.js";
export { EmailVerificationRateLimitPort } from "./ports/email-verification-rate-limit.port.js";
export { PasswordHasherPort } from "./ports/password-hasher.port.js";
export { SessionPort } from "./ports/session.port.js";
export { UserPort } from "./ports/user.port.js";
