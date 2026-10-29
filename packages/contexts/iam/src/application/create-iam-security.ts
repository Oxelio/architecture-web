import type { OutboxWriter } from "@architecture/messaging/application";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { GetIamCapabilities } from "#access-administration/get-iam-capabilities/get-iam-capabilities.contracts";
import { GetIamCapabilitiesUseCase } from "#access-administration/get-iam-capabilities/get-iam-capabilities.use-case";
import type { GetSecurityConfiguration } from "#access-administration/get-security-configuration/get-security-configuration.contracts";
import { GetSecurityConfigurationUseCase } from "#access-administration/get-security-configuration/get-security-configuration.use-case";
import type { PreviewSecurityConfiguration } from "#access-administration/preview-security-configuration/preview-security-configuration.contracts";
import { PreviewSecurityConfigurationUseCase } from "#access-administration/preview-security-configuration/preview-security-configuration.use-case";
import type { PublishSecurityConfiguration } from "#access-administration/publish-security-configuration/publish-security-configuration.contracts";
import { PublishSecurityConfigurationUseCase } from "#access-administration/publish-security-configuration/publish-security-configuration.use-case";
import type { RestoreSecurityConfiguration } from "#access-administration/restore-security-configuration/restore-security-configuration.contracts";
import { RestoreSecurityConfigurationUseCase } from "#access-administration/restore-security-configuration/restore-security-configuration.use-case";
import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";
import type {
  AccountArchiveBuilder,
  AccountAuditData,
  AccountDeletionStore,
  AccountExportStore,
} from "#accounts/account-data/account-data.ports";
import type {
  AccountPolicyReader,
  AccountSecurityPolicyReader,
} from "#accounts/account-policy.reader";
import type { CancelAccountDeletion } from "#accounts/cancel-account-deletion/cancel-account-deletion.contracts";
import { CancelAccountDeletionUseCase } from "#accounts/cancel-account-deletion/cancel-account-deletion.use-case";
import type { DownloadAccountExport } from "#accounts/download-account-export/download-account-export.contracts";
import { DownloadAccountExportUseCase } from "#accounts/download-account-export/download-account-export.use-case";
import type { ListAccountExports } from "#accounts/list-account-exports/list-account-exports.contracts";
import { ListAccountExportsUseCase } from "#accounts/list-account-exports/list-account-exports.use-case";
import type { MaintainIamAccounts } from "#accounts/maintain-iam-accounts/maintain-iam-accounts.contracts";
import { MaintainIamAccountsUseCase } from "#accounts/maintain-iam-accounts/maintain-iam-accounts.use-case";
import type { PasswordPolicyReader } from "#accounts/password-policy/password-policy.reader";
import type { PasswordValidation } from "#accounts/password-policy/password-validation";
import type { PasswordRecoveryStore } from "#accounts/recovery/password-recovery.store";
import type { RecoveryPolicyReader } from "#accounts/recovery/recovery-policy.reader";
import type { RequestAccountDeletion } from "#accounts/request-account-deletion/request-account-deletion.contracts";
import { RequestAccountDeletionUseCase } from "#accounts/request-account-deletion/request-account-deletion.use-case";
import type { RequestAccountExport } from "#accounts/request-account-export/request-account-export.contracts";
import { RequestAccountExportUseCase } from "#accounts/request-account-export/request-account-export.use-case";
import type { RequestPasswordRecovery } from "#accounts/request-password-recovery/request-password-recovery.contracts";
import { RequestPasswordRecoveryUseCase } from "#accounts/request-password-recovery/request-password-recovery.use-case";
import type { ResetRecoveredPassword } from "#accounts/reset-recovered-password/reset-recovered-password.contracts";
import { ResetRecoveredPasswordUseCase } from "#accounts/reset-recovered-password/reset-recovered-password.use-case";
import type {
  AccountSecurityMail,
  RecoveryOriginLimiter,
  SecurityEventRecorder,
  SecurityTokens,
} from "#accounts/security-effects";
import type { ActivateMfa } from "#authentication/activate-mfa/activate-mfa.contracts";
import { ActivateMfaUseCase } from "#authentication/activate-mfa/activate-mfa.use-case";
import type {
  AuthenticationPolicyReader,
  SessionPolicyReader,
  SignInPolicyReader,
} from "#authentication/authentication-policy.reader";
import type { BeginMfaEnrollment } from "#authentication/begin-mfa-enrollment/begin-mfa-enrollment.contracts";
import { BeginMfaEnrollmentUseCase } from "#authentication/begin-mfa-enrollment/begin-mfa-enrollment.use-case";
import type { BeginSecondFactor } from "#authentication/begin-second-factor/begin-second-factor.contracts";
import { BeginSecondFactorUseCase } from "#authentication/begin-second-factor/begin-second-factor.use-case";
import type { CompleteMfaSignIn } from "#authentication/complete-mfa-sign-in/complete-mfa-sign-in.contracts";
import { CompleteMfaSignInUseCase } from "#authentication/complete-mfa-sign-in/complete-mfa-sign-in.use-case";
import type { ConfirmMfaEnrollment } from "#authentication/confirm-mfa-enrollment/confirm-mfa-enrollment.contracts";
import { ConfirmMfaEnrollmentUseCase } from "#authentication/confirm-mfa-enrollment/confirm-mfa-enrollment.use-case";
import type { DisableMfa } from "#authentication/disable-mfa/disable-mfa.contracts";
import { DisableMfaUseCase } from "#authentication/disable-mfa/disable-mfa.use-case";
import type { GetMfaStatus } from "#authentication/get-mfa-status/get-mfa-status.contracts";
import { GetMfaStatusUseCase } from "#authentication/get-mfa-status/get-mfa-status.use-case";
import { IssueSession } from "#authentication/issue-session";
import type { MfaCryptography, MfaStore } from "#authentication/mfa/mfa.ports";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import type { RegenerateMfaBackupCodes } from "#authentication/regenerate-mfa-backup-codes/regenerate-mfa-backup-codes.contracts";
import { RegenerateMfaBackupCodesUseCase } from "#authentication/regenerate-mfa-backup-codes/regenerate-mfa-backup-codes.use-case";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#ports/password-authenticator.repository";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";

export interface IamSecurityDependencies {
  users: UserRepository;
  identities: LoginIdentityRepository;
  passwords: PasswordAuthenticatorRepository;
  sessions: SessionRepository;
  hasher: PasswordHasher;
  policies: AccountPolicyReader &
    AuthenticationPolicyReader &
    SessionPolicyReader &
    PasswordPolicyReader &
    RecoveryPolicyReader &
    SignInPolicyReader &
    AccountSecurityPolicyReader;
  configuration: ConfigurationStore;
  recovery: PasswordRecoveryStore;
  mfa: MfaStore;
  exports: AccountExportStore;
  deletions: AccountDeletionStore;
  validation: Pick<PasswordValidation, "validate">;
  crypto: MfaCryptography;
  tokens: SecurityTokens;
  mail: AccountSecurityMail;
  events: SecurityEventRecorder;
  origins: RecoveryOriginLimiter;
  audit: AccountAuditData;
  archive: AccountArchiveBuilder;
  outbox: OutboxWriter;
}
export interface IamSecurityApplication {
  getCapabilities: GetIamCapabilities;
  getConfiguration: GetSecurityConfiguration;
  previewConfiguration: PreviewSecurityConfiguration;
  publishConfiguration: PublishSecurityConfiguration;
  restoreConfiguration: RestoreSecurityConfiguration;
  requestRecovery: RequestPasswordRecovery;
  resetPassword: ResetRecoveredPassword;
  beginMfaEnrollment: BeginMfaEnrollment;
  confirmMfaEnrollment: ConfirmMfaEnrollment;
  activateMfa: ActivateMfa;
  getMfaStatus: GetMfaStatus;
  beginSecondFactor: BeginSecondFactor;
  completeMfaSignIn: CompleteMfaSignIn;
  regenerateBackupCodes: RegenerateMfaBackupCodes;
  disableMfa: DisableMfa;
  requestExport: RequestAccountExport;
  listExports: ListAccountExports;
  downloadExport: DownloadAccountExport;
  requestDeletion: RequestAccountDeletion;
  cancelDeletion: CancelAccountDeletion;
  maintainAccounts: MaintainIamAccounts;
}

export function createIamSecurity(
  d: IamSecurityDependencies,
): IamSecurityApplication {
  const authorization = new AdministratorAuthorizer(d.users),
    factor = new FactorVerification(d.mfa, d.crypto, d.tokens);
  const reauthentication = new Reauthentication(
    d.users,
    d.passwords,
    d.hasher,
    d.sessions,
    d.policies,
    d.mfa,
    factor,
  );
  const publish = new PublishSecurityConfigurationUseCase(
    authorization,
    d.configuration,
    reauthentication,
    d.events,
  );
  return {
    getCapabilities: new GetIamCapabilitiesUseCase(d.configuration),
    getConfiguration: new GetSecurityConfigurationUseCase(
      authorization,
      d.configuration,
    ),
    previewConfiguration: new PreviewSecurityConfigurationUseCase(
      authorization,
      d.configuration,
    ),
    publishConfiguration: publish,
    restoreConfiguration: new RestoreSecurityConfigurationUseCase(
      authorization,
      d.configuration,
      publish,
      d.events,
    ),
    requestRecovery: new RequestPasswordRecoveryUseCase(
      d.policies,
      d.identities,
      d.users,
      d.recovery,
      d.tokens,
      d.mail,
      d.origins,
      d.events,
    ),
    resetPassword: new ResetRecoveredPasswordUseCase(
      d.recovery,
      d.users,
      d.passwords,
      d.identities,
      d.policies,
      d.validation,
      d.hasher,
      d.tokens,
      d.sessions,
    ),
    beginMfaEnrollment: new BeginMfaEnrollmentUseCase(
      reauthentication,
      d.policies,
      d.users,
      d.identities,
      d.mfa,
      d.crypto,
    ),
    confirmMfaEnrollment: new ConfirmMfaEnrollmentUseCase(
      d.mfa,
      d.crypto,
      d.tokens,
    ),
    activateMfa: new ActivateMfaUseCase(d.users, d.mfa, d.sessions),
    getMfaStatus: new GetMfaStatusUseCase(d.mfa),
    beginSecondFactor: new BeginSecondFactorUseCase(
      d.users,
      d.policies,
      d.mfa,
      d.tokens,
    ),
    completeMfaSignIn: new CompleteMfaSignInUseCase(
      d.mfa,
      factor,
      d.users,
      new IssueSession(d.sessions, d.policies, d.outbox),
      d.events,
      d.policies,
    ),
    regenerateBackupCodes: new RegenerateMfaBackupCodesUseCase(
      reauthentication,
      factor,
      d.mfa,
      d.crypto,
      d.tokens,
    ),
    disableMfa: new DisableMfaUseCase(
      reauthentication,
      factor,
      d.policies,
      d.users,
      d.mfa,
      d.sessions,
    ),
    requestExport: new RequestAccountExportUseCase(
      d.policies,
      reauthentication,
      d.exports,
      d.sessions,
      d.audit,
      d.archive,
      d.tokens,
    ),
    listExports: new ListAccountExportsUseCase(d.exports),
    downloadExport: new DownloadAccountExportUseCase(d.exports),
    requestDeletion: new RequestAccountDeletionUseCase(
      d.policies,
      reauthentication,
      d.users,
      d.identities,
      d.deletions,
      d.tokens,
      d.mail,
      d.sessions,
    ),
    cancelDeletion: new CancelAccountDeletionUseCase(
      d.deletions,
      d.users,
      reauthentication,
      d.mfa,
      factor,
      d.tokens,
    ),
    maintainAccounts: new MaintainIamAccountsUseCase(
      d.deletions,
      d.exports,
      d.audit,
      d.sessions,
    ),
  };
}
