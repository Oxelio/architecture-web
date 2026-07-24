import { UserRepository } from "#repositories/user.repository";
import type { ActivateUser } from "#use-cases/activate-user/activate-user.contracts";
import { ActivateUserUseCase } from "#use-cases/activate-user/activate-user.use-case";
import type { ChangeEmail } from "#use-cases/change-email/change-email.contracts";
import { ChangeEmailUseCase } from "#use-cases/change-email/change-email.use-case";
import type { ChangePassword } from "#use-cases/change-password/change-password.contracts";
import { ChangePasswordUseCase } from "#use-cases/change-password/change-password.use-case";
import { PasswordHasher } from "#services/password-hasher.service";
import type { GetUserProfile } from "#use-cases/get-user-profile/get-user-profile.contracts";
import { GetUserProfileUseCase } from "#use-cases/get-user-profile/get-user-profile.use-case";
import type { ResendEmailVerification } from "#use-cases/resend-email-verification/resend-email-verification.contracts";
import { ResendEmailVerificationUseCase } from "#use-cases/resend-email-verification/resend-email-verification.use-case";
import { EmailSender } from "#services/email-sender.service";
import { EmailVerificationRateLimiter } from "#services/email-verification-rate-limiter.service";
import { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { ResolveSession } from "#use-cases/resolve-session/resolve-session.contracts";
import { ResolveSessionUseCase } from "#use-cases/resolve-session/resolve-session.use-case";
import { SessionRepository } from "#repositories/session.repository";
import type { SignIn } from "#use-cases/sign-in/sign-in.contracts";
import { SignInUseCase } from "#use-cases/sign-in/sign-in.use-case";
import type { SignOut } from "#use-cases/sign-out/sign-out.contracts";
import { SignOutUseCase } from "#use-cases/sign-out/sign-out.use-case";
import type { SignUp } from "#use-cases/sign-up/sign-up.contracts";
import { SignUpUseCase } from "#use-cases/sign-up/sign-up.use-case";
import type { SuspendUser } from "#use-cases/suspend-user/suspend-user.contracts";
import { SuspendUserUseCase } from "#use-cases/suspend-user/suspend-user.use-case";
import type { VerifyEmail } from "#use-cases/verify-email/verify-email.contracts";
import { VerifyEmailUseCase } from "#use-cases/verify-email/verify-email.use-case";

export interface IdentityDependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  passwordHasher: PasswordHasher;
  emailSender: EmailSender;
  emailVerificationRepository: EmailVerificationRepository;
  rateLimiter: EmailVerificationRateLimiter;
}

export interface IdentityApplication {
  activateUser: ActivateUser;
  changeEmail: ChangeEmail;
  changePassword: ChangePassword;
  getUserProfile: GetUserProfile;
  resendEmailVerification: ResendEmailVerification;
  resolveSession: ResolveSession;
  signIn: SignIn;
  signOut: SignOut;
  signUp: SignUp;
  suspendUser: SuspendUser;
  verifyEmail: VerifyEmail;
}

export function createIdentity(
  dependencies: IdentityDependencies,
): IdentityApplication {
  return {
    activateUser: new ActivateUserUseCase(dependencies.userRepository),
    changeEmail: new ChangeEmailUseCase(dependencies.userRepository),
    changePassword: new ChangePasswordUseCase(
      dependencies.userRepository,
      dependencies.passwordHasher,
    ),
    getUserProfile: new GetUserProfileUseCase(dependencies.userRepository),
    resendEmailVerification: new ResendEmailVerificationUseCase(
      dependencies.userRepository,
      dependencies.emailVerificationRepository,
      dependencies.emailSender,
      dependencies.rateLimiter,
    ),
    resolveSession: new ResolveSessionUseCase(
      dependencies.sessionRepository,
      dependencies.userRepository,
    ),
    signIn: new SignInUseCase(
      dependencies.userRepository,
      dependencies.passwordHasher,
      dependencies.sessionRepository,
    ),
    signOut: new SignOutUseCase(dependencies.sessionRepository),
    signUp: new SignUpUseCase(
      dependencies.userRepository,
      dependencies.passwordHasher,
      dependencies.emailVerificationRepository,
      dependencies.emailSender,
    ),
    suspendUser: new SuspendUserUseCase(dependencies.userRepository),
    verifyEmail: new VerifyEmailUseCase(
      dependencies.userRepository,
      dependencies.emailVerificationRepository,
    ),
  };
}
