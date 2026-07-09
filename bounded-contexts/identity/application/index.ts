// Use Cases
export {
  SignUpUseCase,
  type SignUpInput,
  type SignUpError,
  type SignUpResponse,
  type SignUpResult,
} from "#use-cases/sign-up.use-case";

export {
  SignInUseCase,
  type SignInInput,
  type SignInResponse,
  type SignInError,
  type SignInResult,
} from "#use-cases/sign-in.use-case";

export {
  SignOutUseCase,
  type SignOutInput,
  type SignOutResult,
} from "#use-cases/sign-out.use-case";

export {
  GetUserProfileUseCase,
  type GetUserProfileInput,
  type GetUserProfileResponse,
  type GetUserProfileError,
  type GetUserProfileResult,
} from "#use-cases/get-user-profile.use-case";

export {
  ChangeEmailUseCase,
  type ChangeEmailInput,
  type ChangeEmailError,
  type ChangeEmailResult,
} from "#use-cases/change-email.use-case";

export {
  ChangePasswordUseCase,
  type ChangePasswordInput,
  type ChangePasswordError,
  type ChangePasswordResult,
} from "#use-cases/change-password.use-case";

export {
  VerifyEmailUseCase,
  type VerifyEmailInput,
  type VerifyEmailError,
  type VerifyEmailResult,
} from "#use-cases/verify-email.use-case";

export {
  SuspendUserUseCase,
  type SuspendUserInput,
  type SuspendUserError,
  type SuspendUserResult,
} from "#use-cases/suspend-user.use-case";

export {
  ActivateUserUseCase,
  type ActivateUserInput,
  type ActivateUserError,
  type ActivateUserResult,
} from "#use-cases/activate-user.use-case";

export {
  ResolveSessionUseCase,
  type ResolveSessionInput,
  type ResolveSessionResponse,
  type ResolveSessionError,
  type ResolveSessionResult,
} from "./use-cases/resolve-session.use-case.js";

export {
  ResendEmailVerificationUseCase,
  type ResendEmailVerificationInput,
  type ResendEmailVerificationError,
  type ResendEmailVerificationResult,
} from "#use-cases/resend-email-verification.use-case";

// Ports
export { PasswordHasherPort } from "./ports/password-hasher.port.js";
export { UserPort } from "./ports/user.port.js";
export { SessionPort } from "./ports/session.port.js";
export { EmailVerificationPort } from "./ports/email-verification.port.js";
export { EmailSenderPort } from "./ports/email-sender.port.js";
export type { EmailVerificationRecord } from "./ports/email-verification.port.js";
export { EmailVerificationRateLimitPort } from "./ports/email-verification-rate-limit.port.js";
