import type { OutboxWriter } from "@architecture/messaging/application";

import type { ActivateUser } from "#access-administration/activate-user/activate-user.contracts";
import { ActivateUserUseCase } from "#access-administration/activate-user/activate-user.use-case";
import type { AssignUserRole } from "#access-administration/assign-user-role/assign-user-role.contracts";
import { AssignUserRoleUseCase } from "#access-administration/assign-user-role/assign-user-role.use-case";
import type { GetUserAdministrationOverview } from "#access-administration/get-user-administration-overview/get-user-administration-overview.contracts";
import { GetUserAdministrationOverviewUseCase } from "#access-administration/get-user-administration-overview/get-user-administration-overview.use-case";
import type { ListUserSessions } from "#access-administration/list-user-sessions/list-user-sessions.contracts";
import { ListUserSessionsUseCase } from "#access-administration/list-user-sessions/list-user-sessions.use-case";
import type { ListUsers } from "#access-administration/list-users/list-users.contracts";
import { ListUsersUseCase } from "#access-administration/list-users/list-users.use-case";
import type { RevokeUserSession } from "#access-administration/revoke-user-session/revoke-user-session.contracts";
import { RevokeUserSessionUseCase } from "#access-administration/revoke-user-session/revoke-user-session.use-case";
import type { SuspendUser } from "#access-administration/suspend-user/suspend-user.contracts";
import { SuspendUserUseCase } from "#access-administration/suspend-user/suspend-user.use-case";
import type { ChangeEmail } from "#accounts/change-email/change-email.contracts";
import { ChangeEmailUseCase } from "#accounts/change-email/change-email.use-case";
import type { ChangePassword } from "#accounts/change-password/change-password.contracts";
import { ChangePasswordUseCase } from "#accounts/change-password/change-password.use-case";
import type { GetCurrentAccount } from "#accounts/get-current-account/get-current-account.contracts";
import { GetCurrentAccountUseCase } from "#accounts/get-current-account/get-current-account.use-case";
import {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  PasswordStrengthEvaluator,
} from "#accounts/password-policy/password-checks";
import type {
  EvaluatePassword,
  GetPasswordPolicy,
} from "#accounts/password-policy/password-policy.contracts";
import type { PasswordPolicyReader } from "#accounts/password-policy/password-policy.reader";
import {
  EvaluatePasswordUseCase,
  GetPasswordPolicyUseCase,
} from "#accounts/password-policy/password-policy.use-case";
import { PasswordValidation } from "#accounts/password-policy/password-validation";
import type { ResendEmailVerification } from "#accounts/resend-email-verification/resend-email-verification.contracts";
import { ResendEmailVerificationUseCase } from "#accounts/resend-email-verification/resend-email-verification.use-case";
import type { SignUp } from "#accounts/sign-up/sign-up.contracts";
import { SignUpUseCase } from "#accounts/sign-up/sign-up.use-case";
import type { VerifyEmail } from "#accounts/verify-email/verify-email.contracts";
import { VerifyEmailUseCase } from "#accounts/verify-email/verify-email.use-case";
import type { ListCurrentUserSessions } from "#authentication/list-current-user-sessions/list-current-user-sessions.contracts";
import { ListCurrentUserSessionsUseCase } from "#authentication/list-current-user-sessions/list-current-user-sessions.use-case";
import type { ResolveSession } from "#authentication/resolve-session/resolve-session.contracts";
import { ResolveSessionUseCase } from "#authentication/resolve-session/resolve-session.use-case";
import type { RevokeCurrentUserSession } from "#authentication/revoke-current-user-session/revoke-current-user-session.contracts";
import { RevokeCurrentUserSessionUseCase } from "#authentication/revoke-current-user-session/revoke-current-user-session.use-case";
import type { SignIn } from "#authentication/sign-in/sign-in.contracts";
import { SignInUseCase } from "#authentication/sign-in/sign-in.use-case";
import type { SignOut } from "#authentication/sign-out/sign-out.contracts";
import { SignOutUseCase } from "#authentication/sign-out/sign-out.use-case";
import { EmailVerificationRepository } from "#repositories/email-verification.repository";
import { LoginIdentityRepository } from "#repositories/login-identity.repository";
import { PasswordAuthenticatorRepository } from "#repositories/password-authenticator.repository";
import { SessionRepository } from "#repositories/session.repository";
import { UserRepository } from "#repositories/user.repository";
import { UserQueryRepository } from "#repositories/user-query.repository";
import { EmailSender } from "#services/email-sender.service";
import { EmailVerificationRateLimiter } from "#services/email-verification-rate-limiter.service";
import { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import type { IamPolicyProvider } from "#services/iam-policy-provider.service";
import { PasswordHasher } from "#services/password-hasher.service";
import type { SecondFactorGate } from "#services/second-factor-gate.service";
import { IamUnitOfWork } from "#transactions/iam-unit-of-work";

export interface IamDependencies {
  userRepository: UserRepository;
  userQueryRepository: UserQueryRepository;
  loginIdentityRepository: LoginIdentityRepository;
  passwordAuthenticatorRepository: PasswordAuthenticatorRepository;
  sessionRepository: SessionRepository;
  passwordHasher: PasswordHasher;
  policyProvider: IamPolicyProvider;
  passwordPolicyReader: PasswordPolicyReader;
  passwordStrengthEvaluator: PasswordStrengthEvaluator;
  commonPasswordChecker: CommonPasswordChecker;
  compromisedPasswordChecker: CompromisedPasswordChecker;
  emailSender: EmailSender;
  emailVerificationRepository: EmailVerificationRepository;
  rateLimiter: EmailVerificationRateLimiter;
  emailVerificationTokenHasher: EmailVerificationTokenHasher;
  unitOfWork: IamUnitOfWork;
  outbox?: OutboxWriter;
  secondFactorGate?: SecondFactorGate;
}

export interface IamApplication {
  assignUserRole: AssignUserRole;
  activateUser: ActivateUser;
  changeEmail: ChangeEmail;
  changePassword: ChangePassword;
  getCurrentAccount: GetCurrentAccount;
  getUserAdministrationOverview: GetUserAdministrationOverview;
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
  const passwordValidation = new PasswordValidation(
    dependencies.passwordStrengthEvaluator,
    dependencies.commonPasswordChecker,
    dependencies.compromisedPasswordChecker,
  );

  return {
    assignUserRole: new AssignUserRoleUseCase(
      dependencies.userRepository,
      dependencies.unitOfWork,
    ),
    activateUser: new ActivateUserUseCase(
      dependencies.userRepository,
      dependencies.unitOfWork,
    ),
    changeEmail: new ChangeEmailUseCase(
      dependencies.userRepository,
      dependencies.loginIdentityRepository,
      dependencies.emailSender,
      dependencies.emailVerificationTokenHasher,
      dependencies.unitOfWork,
      dependencies.policyProvider,
    ),
    changePassword: new ChangePasswordUseCase(
      dependencies.userRepository,
      dependencies.loginIdentityRepository,
      dependencies.passwordAuthenticatorRepository,
      dependencies.passwordHasher,
      dependencies.sessionRepository,
      dependencies.passwordPolicyReader,
      passwordValidation,
      dependencies.unitOfWork,
    ),
    getCurrentAccount: new GetCurrentAccountUseCase(
      dependencies.userQueryRepository,
    ),
    getUserAdministrationOverview: new GetUserAdministrationOverviewUseCase(
      dependencies.userRepository,
      dependencies.userQueryRepository,
    ),
    listUsers: new ListUsersUseCase(
      dependencies.userRepository,
      dependencies.userQueryRepository,
    ),
    listCurrentUserSessions: new ListCurrentUserSessionsUseCase(
      dependencies.userRepository,
      dependencies.sessionRepository,
      dependencies.policyProvider,
    ),
    listUserSessions: new ListUserSessionsUseCase(
      dependencies.userRepository,
      dependencies.sessionRepository,
    ),
    getPasswordPolicy: new GetPasswordPolicyUseCase(
      dependencies.passwordPolicyReader,
    ),
    evaluatePassword: new EvaluatePasswordUseCase(
      dependencies.passwordPolicyReader,
      passwordValidation,
    ),
    resendEmailVerification: new ResendEmailVerificationUseCase(
      dependencies.userRepository,
      dependencies.loginIdentityRepository,
      dependencies.emailSender,
      dependencies.rateLimiter,
      dependencies.emailVerificationTokenHasher,
      dependencies.unitOfWork,
    ),
    resolveSession: new ResolveSessionUseCase(
      dependencies.sessionRepository,
      dependencies.userRepository,
    ),
    revokeCurrentUserSession: new RevokeCurrentUserSessionUseCase(
      dependencies.sessionRepository,
      dependencies.policyProvider,
    ),
    revokeUserSession: new RevokeUserSessionUseCase(
      dependencies.userRepository,
      dependencies.sessionRepository,
    ),
    signIn: new SignInUseCase(
      dependencies.userRepository,
      dependencies.loginIdentityRepository,
      dependencies.passwordAuthenticatorRepository,
      dependencies.passwordHasher,
      dependencies.sessionRepository,
      dependencies.policyProvider,
      dependencies.secondFactorGate,
      dependencies.outbox,
    ),
    signOut: new SignOutUseCase(dependencies.sessionRepository),
    signUp: new SignUpUseCase(
      dependencies.loginIdentityRepository,
      dependencies.passwordHasher,
      dependencies.emailSender,
      dependencies.emailVerificationTokenHasher,
      dependencies.passwordPolicyReader,
      passwordValidation,
      dependencies.unitOfWork,
      dependencies.policyProvider,
    ),
    suspendUser: new SuspendUserUseCase(
      dependencies.userRepository,
      dependencies.sessionRepository,
      dependencies.unitOfWork,
    ),
    verifyEmail: new VerifyEmailUseCase(
      dependencies.loginIdentityRepository,
      dependencies.emailVerificationRepository,
      dependencies.emailVerificationTokenHasher,
      dependencies.unitOfWork,
    ),
  };
}
