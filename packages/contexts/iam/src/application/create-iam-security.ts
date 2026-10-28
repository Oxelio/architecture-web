import type { OutboxWriter } from "@architecture/messaging/application";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";
import {
  GetIamCapabilitiesUseCase,
  GetSecurityConfigurationUseCase,
  PreviewSecurityConfigurationUseCase,
  PublishSecurityConfigurationUseCase,
  RestoreSecurityConfigurationUseCase,
} from "#access-administration/security-configuration/security-configuration.use-cases";
import type {
  AccountArchiveBuilder,
  AccountAuditData,
  AccountDeletionStore,
  AccountExportStore,
} from "#accounts/account-data/account-data.ports";
import {
  CancelAccountDeletionUseCase,
  MaintainIamAccountsUseCase,
  RequestAccountDeletionUseCase,
} from "#accounts/account-data/account-deletion.use-cases";
import {
  DownloadAccountExportUseCase,
  ListAccountExportsUseCase,
  RequestAccountExportUseCase,
} from "#accounts/account-data/account-export.use-cases";
import type { AccountPolicyReader } from "#accounts/account-policy.reader";
import type { PasswordPolicyReader } from "#accounts/password-policy/password-policy.reader";
import type { PasswordValidation } from "#accounts/password-policy/password-validation";
import type { PasswordRecoveryStore } from "#accounts/recovery/password-recovery.store";
import {
  RequestPasswordRecoveryUseCase,
  ResetRecoveredPasswordUseCase,
} from "#accounts/recovery/password-recovery.use-cases";
import type { RecoveryPolicyReader } from "#accounts/recovery/recovery-policy.reader";
import type {
  AccountSecurityMail,
  RecoveryOriginLimiter,
  SecurityEventRecorder,
  SecurityTokens,
} from "#accounts/security-effects";
import type {
  AuthenticationPolicyReader,
  SessionPolicyReader,
} from "#authentication/authentication-policy.reader";
import { IssueSession } from "#authentication/issue-session";
import type { MfaCryptography, MfaStore } from "#authentication/mfa/mfa.ports";
import {
  ActivateMfaUseCase,
  BeginMfaEnrollmentUseCase,
  BeginSecondFactorUseCase,
  CompleteMfaSignInUseCase,
  ConfirmMfaEnrollmentUseCase,
  DisableMfaUseCase,
  GetMfaStatusUseCase,
  RegenerateMfaBackupCodesUseCase,
} from "#authentication/mfa/mfa.use-cases";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#repositories/password-authenticator.repository";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
export type { IamResult } from "./application-result.js";
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
    RecoveryPolicyReader;
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
export function createIamSecurity(d: IamSecurityDependencies) {
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
export type IamSecurityApplication = ReturnType<typeof createIamSecurity>;
