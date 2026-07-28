import type { PasswordPolicy } from "#domain/password-policy";
import { EmailVerificationRepository } from "#repositories/email-verification.repository";
import { SessionAdministrationRepository } from "#repositories/session.repository";
import { UserAdministrationRepository } from "#repositories/user.repository";
import { EmailSender } from "#services/email-sender.service";
import { EmailVerificationRateLimiter } from "#services/email-verification-rate-limiter.service";
import { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import { PasswordHasher } from "#services/password-hasher.service";
import { PasswordPolicyValidator } from "#services/password-policy-validator.service";
import {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  PasswordStrengthEvaluator,
} from "#services/password-security.service";
import type { ActivateUser } from "#use-cases/activate-user/activate-user.contracts";
import { ActivateUserUseCase } from "#use-cases/activate-user/activate-user.use-case";
import type { AssignUserRole } from "#use-cases/assign-user-role/assign-user-role.contracts";
import { AssignUserRoleUseCase } from "#use-cases/assign-user-role/assign-user-role.use-case";
import type { ChangeEmail } from "#use-cases/change-email/change-email.contracts";
import { ChangeEmailUseCase } from "#use-cases/change-email/change-email.use-case";
import type { ChangePassword } from "#use-cases/change-password/change-password.contracts";
import { ChangePasswordUseCase } from "#use-cases/change-password/change-password.use-case";
import type { GetUserProfile } from "#use-cases/get-user-profile/get-user-profile.contracts";
import { GetUserProfileUseCase } from "#use-cases/get-user-profile/get-user-profile.use-case";
import type { ListUserSessions } from "#use-cases/list-user-sessions/list-user-sessions.contracts";
import { ListUserSessionsUseCase } from "#use-cases/list-user-sessions/list-user-sessions.use-case";
import type { ListUsers } from "#use-cases/list-users/list-users.contracts";
import { ListUsersUseCase } from "#use-cases/list-users/list-users.use-case";
import type {
  EvaluatePassword,
  GetPasswordPolicy,
} from "#use-cases/password-policy/password-policy.contracts";
import {
  EvaluatePasswordUseCase,
  GetPasswordPolicyUseCase,
} from "#use-cases/password-policy/password-policy.use-case";
import type { ResendEmailVerification } from "#use-cases/resend-email-verification/resend-email-verification.contracts";
import { ResendEmailVerificationUseCase } from "#use-cases/resend-email-verification/resend-email-verification.use-case";
import type { ResolveSession } from "#use-cases/resolve-session/resolve-session.contracts";
import { ResolveSessionUseCase } from "#use-cases/resolve-session/resolve-session.use-case";
import type { RevokeUserSession } from "#use-cases/revoke-user-session/revoke-user-session.contracts";
import { RevokeUserSessionUseCase } from "#use-cases/revoke-user-session/revoke-user-session.use-case";
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
  userRepository: UserAdministrationRepository;
  sessionRepository: SessionAdministrationRepository;
  passwordHasher: PasswordHasher;
  passwordPolicy: PasswordPolicy;
  privilegedPasswordPolicy: PasswordPolicy;
  passwordStrengthEvaluator: PasswordStrengthEvaluator;
  commonPasswordChecker: CommonPasswordChecker;
  compromisedPasswordChecker: CompromisedPasswordChecker;
  emailSender: EmailSender;
  emailVerificationRepository: EmailVerificationRepository;
  rateLimiter: EmailVerificationRateLimiter;
  emailVerificationTokenHasher: EmailVerificationTokenHasher;
}

export interface IdentityApplication {
  assignUserRole: AssignUserRole;
  activateUser: ActivateUser;
  changeEmail: ChangeEmail;
  changePassword: ChangePassword;
  getUserProfile: GetUserProfile;
  listUsers: ListUsers;
  listUserSessions: ListUserSessions;
  getPasswordPolicy: GetPasswordPolicy;
  evaluatePassword: EvaluatePassword;
  resendEmailVerification: ResendEmailVerification;
  resolveSession: ResolveSession;
  revokeUserSession: RevokeUserSession;
  signIn: SignIn;
  signOut: SignOut;
  signUp: SignUp;
  suspendUser: SuspendUser;
  verifyEmail: VerifyEmail;
}

export function createIdentity(
  dependencies: IdentityDependencies,
): IdentityApplication {
  const passwordPolicy = new PasswordPolicyValidator(
    dependencies.passwordPolicy,
    dependencies.passwordStrengthEvaluator,
    dependencies.commonPasswordChecker,
    dependencies.compromisedPasswordChecker,
  );
  const privilegedPasswordPolicy = new PasswordPolicyValidator(
    dependencies.privilegedPasswordPolicy,
    dependencies.passwordStrengthEvaluator,
    dependencies.commonPasswordChecker,
    dependencies.compromisedPasswordChecker,
  );

  return {
    assignUserRole: new AssignUserRoleUseCase(dependencies.userRepository),
    activateUser: new ActivateUserUseCase(dependencies.userRepository),
    changeEmail: new ChangeEmailUseCase(
      dependencies.userRepository,
      dependencies.emailVerificationRepository,
      dependencies.emailSender,
      dependencies.emailVerificationTokenHasher,
    ),
    changePassword: new ChangePasswordUseCase(
      dependencies.userRepository,
      dependencies.passwordHasher,
      dependencies.sessionRepository,
      passwordPolicy,
      privilegedPasswordPolicy,
    ),
    getUserProfile: new GetUserProfileUseCase(dependencies.userRepository),
    listUsers: new ListUsersUseCase(dependencies.userRepository),
    listUserSessions: new ListUserSessionsUseCase(
      dependencies.userRepository,
      dependencies.sessionRepository,
    ),
    getPasswordPolicy: new GetPasswordPolicyUseCase(passwordPolicy),
    evaluatePassword: new EvaluatePasswordUseCase(passwordPolicy),
    resendEmailVerification: new ResendEmailVerificationUseCase(
      dependencies.userRepository,
      dependencies.emailVerificationRepository,
      dependencies.emailSender,
      dependencies.rateLimiter,
      dependencies.emailVerificationTokenHasher,
    ),
    resolveSession: new ResolveSessionUseCase(
      dependencies.sessionRepository,
      dependencies.userRepository,
    ),
    revokeUserSession: new RevokeUserSessionUseCase(
      dependencies.userRepository,
      dependencies.sessionRepository,
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
      dependencies.emailVerificationTokenHasher,
      passwordPolicy,
    ),
    suspendUser: new SuspendUserUseCase(
      dependencies.userRepository,
      dependencies.sessionRepository,
    ),
    verifyEmail: new VerifyEmailUseCase(
      dependencies.userRepository,
      dependencies.emailVerificationRepository,
      dependencies.emailVerificationTokenHasher,
    ),
  };
}
