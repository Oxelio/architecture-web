import type { OutboxWriter } from "@architecture/messaging/application";

import type { AdministrationApplication } from "#access-administration/access-administration.application";
import { ActivateUserUseCase } from "#access-administration/activate-user/activate-user.use-case";
import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import { AssignUserRoleUseCase } from "#access-administration/assign-user-role/assign-user-role.use-case";
import { GetIamCapabilitiesUseCase } from "#access-administration/get-iam-capabilities/get-iam-capabilities.use-case";
import { GetSecurityConfigurationUseCase } from "#access-administration/get-security-configuration/get-security-configuration.use-case";
import { GetUserAdministrationOverviewUseCase } from "#access-administration/get-user-administration-overview/get-user-administration-overview.use-case";
import { ListUserSessionsUseCase } from "#access-administration/list-user-sessions/list-user-sessions.use-case";
import { ListUsersUseCase } from "#access-administration/list-users/list-users.use-case";
import { PreviewSecurityConfigurationUseCase } from "#access-administration/preview-security-configuration/preview-security-configuration.use-case";
import { PublishSecurityConfigurationUseCase } from "#access-administration/publish-security-configuration/publish-security-configuration.use-case";
import { RestoreSecurityConfigurationUseCase } from "#access-administration/restore-security-configuration/restore-security-configuration.use-case";
import { RevokeUserSessionUseCase } from "#access-administration/revoke-user-session/revoke-user-session.use-case";
import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";
import { SuspendUserUseCase } from "#access-administration/suspend-user/suspend-user.use-case";
import type {
  AccountArchiveBuilder,
  AccountAuditData,
  AccountDeletionStore,
  AccountExportStore,
} from "#accounts/account-data/account-data.ports";
import type {
  AccountPolicyReader,
  AccountSecurityPolicyReader,
  RegistrationPolicyReader,
} from "#accounts/account-policy.reader";
import type { AccountsApplication } from "#accounts/accounts.application";
import { CancelAccountDeletionUseCase } from "#accounts/cancel-account-deletion/cancel-account-deletion.use-case";
import { ChangeEmailUseCase } from "#accounts/change-email/change-email.use-case";
import { ChangePasswordUseCase } from "#accounts/change-password/change-password.use-case";
import { DownloadAccountExportUseCase } from "#accounts/download-account-export/download-account-export.use-case";
import type { EmailVerificationRateLimiter } from "#accounts/email-verification/email-verification-rate-limiter.port";
import type { EmailVerificationTokenHasher } from "#accounts/email-verification/email-verification-token-hasher.port";
import type { VerificationEmailSender } from "#accounts/email-verification/verification-email-sender.port";
import { GetCurrentAccountUseCase } from "#accounts/get-current-account/get-current-account.use-case";
import { ListAccountExportsUseCase } from "#accounts/list-account-exports/list-account-exports.use-case";
import { MaintainIamAccountsUseCase } from "#accounts/maintain-iam-accounts/maintain-iam-accounts.use-case";
import type {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  PasswordStrengthEvaluator,
} from "#accounts/password-policy/password-checks";
import type { PasswordPolicyReader } from "#accounts/password-policy/password-policy.reader";
import {
  EvaluatePasswordUseCase,
  GetPasswordPolicyUseCase,
} from "#accounts/password-policy/password-policy.use-case";
import { PasswordValidation } from "#accounts/password-policy/password-validation";
import type { PasswordRecoveryStore } from "#accounts/recovery/password-recovery.store";
import type { RecoveryPolicyReader } from "#accounts/recovery/recovery-policy.reader";
import { RequestAccountDeletionUseCase } from "#accounts/request-account-deletion/request-account-deletion.use-case";
import { RequestAccountExportUseCase } from "#accounts/request-account-export/request-account-export.use-case";
import { RequestPasswordRecoveryUseCase } from "#accounts/request-password-recovery/request-password-recovery.use-case";
import { ResendEmailVerificationUseCase } from "#accounts/resend-email-verification/resend-email-verification.use-case";
import { ResetRecoveredPasswordUseCase } from "#accounts/reset-recovered-password/reset-recovered-password.use-case";
import type {
  AccountSecurityMail,
  RecoveryOriginLimiter,
  SecurityEventRecorder,
  SecurityTokens,
} from "#accounts/security-effects";
import { SignUpUseCase } from "#accounts/sign-up/sign-up.use-case";
import { VerifyEmailUseCase } from "#accounts/verify-email/verify-email.use-case";
import { ActivateMfaUseCase } from "#authentication/activate-mfa/activate-mfa.use-case";
import type { AuthenticationApplication } from "#authentication/authentication.application";
import type {
  AuthenticationPolicyReader,
  SessionPolicyReader,
  SignInPolicyReader,
} from "#authentication/authentication-policy.reader";
import { BeginMfaEnrollmentUseCase } from "#authentication/begin-mfa-enrollment/begin-mfa-enrollment.use-case";
import { BeginSecondFactorUseCase } from "#authentication/begin-second-factor/begin-second-factor.use-case";
import { CompleteMfaSignInUseCase } from "#authentication/complete-mfa-sign-in/complete-mfa-sign-in.use-case";
import { ConfirmMfaEnrollmentUseCase } from "#authentication/confirm-mfa-enrollment/confirm-mfa-enrollment.use-case";
import { DisableMfaUseCase } from "#authentication/disable-mfa/disable-mfa.use-case";
import { GetMfaStatusUseCase } from "#authentication/get-mfa-status/get-mfa-status.use-case";
import { IssueSession } from "#authentication/issue-session";
import { ListCurrentUserSessionsUseCase } from "#authentication/list-current-user-sessions/list-current-user-sessions.use-case";
import type { MfaCryptography, MfaStore } from "#authentication/mfa/mfa.ports";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import { RegenerateMfaBackupCodesUseCase } from "#authentication/regenerate-mfa-backup-codes/regenerate-mfa-backup-codes.use-case";
import { ResolveSessionUseCase } from "#authentication/resolve-session/resolve-session.use-case";
import { RevokeCurrentUserSessionUseCase } from "#authentication/revoke-current-user-session/revoke-current-user-session.use-case";
import { SignInUseCase } from "#authentication/sign-in/sign-in.use-case";
import { SignOutUseCase } from "#authentication/sign-out/sign-out.use-case";
import type { EmailVerificationRepository } from "#ports/email-verification.repository";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#ports/password-authenticator.repository";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import type { UserQueryRepository } from "#ports/user-query.repository";

export interface IamDependencies {
  userRepository: UserRepository;
  userQueryRepository: UserQueryRepository;
  loginIdentityRepository: LoginIdentityRepository;
  passwordAuthenticatorRepository: PasswordAuthenticatorRepository;
  sessionRepository: SessionRepository;
  passwordHasher: PasswordHasher;
  policies: AccountPolicyReader &
    RegistrationPolicyReader &
    AccountSecurityPolicyReader &
    AuthenticationPolicyReader &
    SessionPolicyReader &
    SignInPolicyReader &
    PasswordPolicyReader &
    RecoveryPolicyReader;
  passwordStrengthEvaluator: PasswordStrengthEvaluator;
  commonPasswordChecker: CommonPasswordChecker;
  compromisedPasswordChecker: CompromisedPasswordChecker;
  emailSender: VerificationEmailSender;
  emailVerificationRepository: EmailVerificationRepository;
  rateLimiter: EmailVerificationRateLimiter;
  emailVerificationTokenHasher: EmailVerificationTokenHasher;
  unitOfWork: IamUnitOfWork;
  outbox: OutboxWriter;
  configuration: ConfigurationStore;
  recovery: PasswordRecoveryStore;
  mfa: MfaStore;
  exports: AccountExportStore;
  deletions: AccountDeletionStore;
  crypto: MfaCryptography;
  tokens: SecurityTokens;
  mail: AccountSecurityMail;
  events: SecurityEventRecorder;
  origins: RecoveryOriginLimiter;
  audit: AccountAuditData;
  archive: AccountArchiveBuilder;
}

export interface IamApplication {
  accounts: AccountsApplication;
  authentication: AuthenticationApplication;
  administration: AdministrationApplication;
}

export function createIam(dependencies: IamDependencies): IamApplication {
  const passwordValidation = new PasswordValidation(
    dependencies.passwordStrengthEvaluator,
    dependencies.commonPasswordChecker,
    dependencies.compromisedPasswordChecker,
  );
  const authorization = new AdministratorAuthorizer(
    dependencies.userRepository,
  );
  const factor = new FactorVerification(
    dependencies.mfa,
    dependencies.crypto,
    dependencies.tokens,
  );
  const reauthentication = new Reauthentication(
    dependencies.userRepository,
    dependencies.passwordAuthenticatorRepository,
    dependencies.passwordHasher,
    dependencies.sessionRepository,
    dependencies.policies,
    dependencies.mfa,
    factor,
  );
  const issueSession = new IssueSession(
    dependencies.sessionRepository,
    dependencies.policies,
    dependencies.outbox,
  );
  const beginSecondFactor = new BeginSecondFactorUseCase(
    dependencies.userRepository,
    dependencies.policies,
    dependencies.mfa,
    dependencies.tokens,
  );
  const publish = new PublishSecurityConfigurationUseCase(
    authorization,
    dependencies.configuration,
    reauthentication,
    dependencies.events,
  );
  return {
    accounts: {
      changeEmail: new ChangeEmailUseCase(
        dependencies.userRepository,
        dependencies.loginIdentityRepository,
        dependencies.emailSender,
        dependencies.emailVerificationTokenHasher,
        dependencies.unitOfWork,
        dependencies.policies,
      ),
      changePassword: new ChangePasswordUseCase(
        dependencies.userRepository,
        dependencies.loginIdentityRepository,
        dependencies.passwordAuthenticatorRepository,
        dependencies.passwordHasher,
        dependencies.sessionRepository,
        dependencies.policies,
        passwordValidation,
        dependencies.unitOfWork,
      ),
      getCurrentAccount: new GetCurrentAccountUseCase(
        dependencies.userQueryRepository,
      ),
      getPasswordPolicy: new GetPasswordPolicyUseCase(dependencies.policies),
      evaluatePassword: new EvaluatePasswordUseCase(
        dependencies.policies,
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
      signUp: new SignUpUseCase(
        dependencies.loginIdentityRepository,
        dependencies.passwordHasher,
        dependencies.emailSender,
        dependencies.emailVerificationTokenHasher,
        passwordValidation,
        dependencies.unitOfWork,
        dependencies.policies,
      ),
      verifyEmail: new VerifyEmailUseCase(
        dependencies.loginIdentityRepository,
        dependencies.emailVerificationRepository,
        dependencies.emailVerificationTokenHasher,
        dependencies.unitOfWork,
      ),
      requestRecovery: new RequestPasswordRecoveryUseCase(
        dependencies.policies,
        dependencies.loginIdentityRepository,
        dependencies.userRepository,
        dependencies.recovery,
        dependencies.tokens,
        dependencies.mail,
        dependencies.origins,
        dependencies.events,
      ),
      resetPassword: new ResetRecoveredPasswordUseCase(
        dependencies.recovery,
        dependencies.userRepository,
        dependencies.passwordAuthenticatorRepository,
        dependencies.loginIdentityRepository,
        dependencies.policies,
        passwordValidation,
        dependencies.passwordHasher,
        dependencies.tokens,
        dependencies.sessionRepository,
      ),
      requestExport: new RequestAccountExportUseCase(
        dependencies.policies,
        reauthentication,
        dependencies.exports,
        dependencies.sessionRepository,
        dependencies.audit,
        dependencies.archive,
        dependencies.tokens,
      ),
      listExports: new ListAccountExportsUseCase(dependencies.exports),
      downloadExport: new DownloadAccountExportUseCase(dependencies.exports),
      requestDeletion: new RequestAccountDeletionUseCase(
        dependencies.policies,
        reauthentication,
        dependencies.userRepository,
        dependencies.loginIdentityRepository,
        dependencies.deletions,
        dependencies.tokens,
        dependencies.mail,
        dependencies.sessionRepository,
      ),
      cancelDeletion: new CancelAccountDeletionUseCase(
        dependencies.deletions,
        dependencies.userRepository,
        reauthentication,
        dependencies.mfa,
        factor,
        dependencies.tokens,
      ),
      maintainAccounts: new MaintainIamAccountsUseCase(
        dependencies.deletions,
        dependencies.exports,
        dependencies.audit,
        dependencies.sessionRepository,
      ),
    },
    authentication: {
      listCurrentUserSessions: new ListCurrentUserSessionsUseCase(
        dependencies.userRepository,
        dependencies.sessionRepository,
        dependencies.policies,
      ),
      resolveSession: new ResolveSessionUseCase(
        dependencies.sessionRepository,
        dependencies.userRepository,
      ),
      revokeCurrentUserSession: new RevokeCurrentUserSessionUseCase(
        dependencies.sessionRepository,
        dependencies.policies,
      ),
      signIn: new SignInUseCase(
        dependencies.userRepository,
        dependencies.loginIdentityRepository,
        dependencies.passwordAuthenticatorRepository,
        dependencies.passwordHasher,
        dependencies.policies,
        beginSecondFactor,
        issueSession,
      ),
      signOut: new SignOutUseCase(dependencies.sessionRepository),
      beginMfaEnrollment: new BeginMfaEnrollmentUseCase(
        reauthentication,
        dependencies.policies,
        dependencies.userRepository,
        dependencies.loginIdentityRepository,
        dependencies.mfa,
        dependencies.crypto,
      ),
      confirmMfaEnrollment: new ConfirmMfaEnrollmentUseCase(
        dependencies.mfa,
        dependencies.crypto,
        dependencies.tokens,
      ),
      activateMfa: new ActivateMfaUseCase(
        dependencies.userRepository,
        dependencies.mfa,
        dependencies.sessionRepository,
      ),
      getMfaStatus: new GetMfaStatusUseCase(dependencies.mfa),
      beginSecondFactor,
      completeMfaSignIn: new CompleteMfaSignInUseCase(
        dependencies.mfa,
        factor,
        dependencies.userRepository,
        issueSession,
        dependencies.events,
        dependencies.policies,
      ),
      regenerateBackupCodes: new RegenerateMfaBackupCodesUseCase(
        reauthentication,
        factor,
        dependencies.mfa,
        dependencies.crypto,
        dependencies.tokens,
      ),
      disableMfa: new DisableMfaUseCase(
        reauthentication,
        factor,
        dependencies.policies,
        dependencies.userRepository,
        dependencies.mfa,
        dependencies.sessionRepository,
      ),
    },
    administration: {
      assignUserRole: new AssignUserRoleUseCase(
        authorization,
        dependencies.unitOfWork,
      ),
      activateUser: new ActivateUserUseCase(
        authorization,
        dependencies.unitOfWork,
      ),
      getUserAdministrationOverview: new GetUserAdministrationOverviewUseCase(
        authorization,
        dependencies.userQueryRepository,
      ),
      listUsers: new ListUsersUseCase(
        authorization,
        dependencies.userQueryRepository,
      ),
      listUserSessions: new ListUserSessionsUseCase(
        dependencies.userRepository,
        dependencies.sessionRepository,
        dependencies.policies,
        authorization,
      ),
      revokeUserSession: new RevokeUserSessionUseCase(
        dependencies.userRepository,
        dependencies.sessionRepository,
        dependencies.policies,
        authorization,
      ),
      suspendUser: new SuspendUserUseCase(
        authorization,
        dependencies.sessionRepository,
        dependencies.unitOfWork,
      ),
      getCapabilities: new GetIamCapabilitiesUseCase(
        dependencies.configuration,
      ),
      getConfiguration: new GetSecurityConfigurationUseCase(
        authorization,
        dependencies.configuration,
      ),
      previewConfiguration: new PreviewSecurityConfigurationUseCase(
        authorization,
        dependencies.configuration,
      ),
      publishConfiguration: publish,
      restoreConfiguration: new RestoreSecurityConfigurationUseCase(
        authorization,
        dependencies.configuration,
        publish,
        dependencies.events,
      ),
    },
  };
}
