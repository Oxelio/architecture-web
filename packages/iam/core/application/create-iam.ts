import type { ActivateUser } from "#access-administration/use-cases/activate-user/activate-user.contracts";
import { ActivateUserUseCase } from "#access-administration/use-cases/activate-user/activate-user.use-case";
import type { AssignUserRole } from "#access-administration/use-cases/assign-user-role/assign-user-role.contracts";
import { AssignUserRoleUseCase } from "#access-administration/use-cases/assign-user-role/assign-user-role.use-case";
import type { ListUserSessions } from "#access-administration/use-cases/list-user-sessions/list-user-sessions.contracts";
import { ListUserSessionsUseCase } from "#access-administration/use-cases/list-user-sessions/list-user-sessions.use-case";
import type { ListUsers } from "#access-administration/use-cases/list-users/list-users.contracts";
import { ListUsersUseCase } from "#access-administration/use-cases/list-users/list-users.use-case";
import type { RevokeUserSession } from "#access-administration/use-cases/revoke-user-session/revoke-user-session.contracts";
import { RevokeUserSessionUseCase } from "#access-administration/use-cases/revoke-user-session/revoke-user-session.use-case";
import type { SuspendUser } from "#access-administration/use-cases/suspend-user/suspend-user.contracts";
import { SuspendUserUseCase } from "#access-administration/use-cases/suspend-user/suspend-user.use-case";
import type { ChangeEmail } from "#accounts/use-cases/change-email/change-email.contracts";
import { ChangeEmailUseCase } from "#accounts/use-cases/change-email/change-email.use-case";
import type { ChangePassword } from "#accounts/use-cases/change-password/change-password.contracts";
import { ChangePasswordUseCase } from "#accounts/use-cases/change-password/change-password.use-case";
import type { GetCurrentAccount } from "#accounts/use-cases/get-current-account/get-current-account.contracts";
import { GetCurrentAccountUseCase } from "#accounts/use-cases/get-current-account/get-current-account.use-case";
import type {
  EvaluatePassword,
  GetPasswordPolicy,
} from "#accounts/use-cases/password-policy/password-policy.contracts";
import {
  EvaluatePasswordUseCase,
  GetPasswordPolicyUseCase,
} from "#accounts/use-cases/password-policy/password-policy.use-case";
import type { ResendEmailVerification } from "#accounts/use-cases/resend-email-verification/resend-email-verification.contracts";
import { ResendEmailVerificationUseCase } from "#accounts/use-cases/resend-email-verification/resend-email-verification.use-case";
import type { SignUp } from "#accounts/use-cases/sign-up/sign-up.contracts";
import { SignUpUseCase } from "#accounts/use-cases/sign-up/sign-up.use-case";
import type { VerifyEmail } from "#accounts/use-cases/verify-email/verify-email.contracts";
import { VerifyEmailUseCase } from "#accounts/use-cases/verify-email/verify-email.use-case";
import type { ListCurrentUserSessions } from "#authentication/use-cases/list-current-user-sessions/list-current-user-sessions.contracts";
import { ListCurrentUserSessionsUseCase } from "#authentication/use-cases/list-current-user-sessions/list-current-user-sessions.use-case";
import type { ResolveSession } from "#authentication/use-cases/resolve-session/resolve-session.contracts";
import { ResolveSessionUseCase } from "#authentication/use-cases/resolve-session/resolve-session.use-case";
import type { RevokeCurrentUserSession } from "#authentication/use-cases/revoke-current-user-session/revoke-current-user-session.contracts";
import { RevokeCurrentUserSessionUseCase } from "#authentication/use-cases/revoke-current-user-session/revoke-current-user-session.use-case";
import type { SignIn } from "#authentication/use-cases/sign-in/sign-in.contracts";
import { SignInUseCase } from "#authentication/use-cases/sign-in/sign-in.use-case";
import type { SignOut } from "#authentication/use-cases/sign-out/sign-out.contracts";
import { SignOutUseCase } from "#authentication/use-cases/sign-out/sign-out.use-case";
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

export interface IamDependencies {
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

export interface IamApplication {
  assignUserRole: AssignUserRole;
  activateUser: ActivateUser;
  changeEmail: ChangeEmail;
  changePassword: ChangePassword;
  getCurrentAccount: GetCurrentAccount;
  listUsers: ListUsers;
  listCurrentUserSessions: ListCurrentUserSessions;
  listUserSessions: ListUserSessions;
  getPasswordPolicy: GetPasswordPolicy;
  evaluatePassword: EvaluatePassword;
  resendEmailVerification: ResendEmailVerification;
  resolveSession: ResolveSession;
  revokeCurrentUserSession: RevokeCurrentUserSession;
  revokeUserSession: RevokeUserSession;
  signIn: SignIn;
  signOut: SignOut;
  signUp: SignUp;
  suspendUser: SuspendUser;
  verifyEmail: VerifyEmail;
}

export function createIam(dependencies: IamDependencies): IamApplication {
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
    getCurrentAccount: new GetCurrentAccountUseCase(
      dependencies.userRepository,
    ),
    listUsers: new ListUsersUseCase(dependencies.userRepository),
    listCurrentUserSessions: new ListCurrentUserSessionsUseCase(
      dependencies.userRepository,
      dependencies.sessionRepository,
    ),
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
    revokeCurrentUserSession: new RevokeCurrentUserSessionUseCase(
      dependencies.sessionRepository,
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
