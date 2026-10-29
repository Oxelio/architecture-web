import type {
  ActivateMfaError,
  BeginMfaEnrollmentError,
  CancelAccountDeletionError,
  CompleteMfaSignInError,
  ConfirmMfaEnrollmentError,
  DisableMfaError,
  DownloadAccountExportError,
  FactorVerificationError,
  GetSecurityConfigurationError,
  PreviewSecurityConfigurationError,
  PublishSecurityConfigurationError,
  RecentAuthenticationError,
  RegenerateMfaBackupCodesError,
  RequestAccountDeletionError,
  RequestAccountExportError,
  RequestPasswordRecoveryError,
  ResetRecoveredPasswordError,
  RestoreSecurityConfigurationError,
  StrongAuthenticationError,
} from "@architecture/iam/application";

import type { HttpErrorDefinitions } from "#types/http.types";

// Shared checks propagate the same errors in these operations. Each operation
// still declares its complete mapping and may choose a different HTTP status.
const recentAuthenticationErrors = {
  "authentication.invalid_credentials": {
    code: "authentication.invalid_credentials",
    status: 401,
  },
  "authentication.recent_proof_required": {
    code: "authentication.recent_proof_required",
    status: 401,
  },
} as const satisfies HttpErrorDefinitions<RecentAuthenticationError["code"]>;

const factorVerificationErrors = {
  "mfa.not_enabled": { code: "mfa.not_enabled", status: 409 },
  "mfa.invalid_challenge": { code: "mfa.invalid_challenge", status: 401 },
  "mfa.invalid_code": { code: "mfa.invalid_code", status: 401 },
} as const satisfies HttpErrorDefinitions<FactorVerificationError["code"]>;

const strongAuthenticationErrors = {
  ...recentAuthenticationErrors,
  ...factorVerificationErrors,
  "mfa.code_required": { code: "mfa.code_required", status: 400 },
} as const satisfies HttpErrorDefinitions<StrongAuthenticationError["code"]>;

export const RequestPasswordRecoveryHttpErrors = {
  "email.invalid_format": { code: "email.invalid_format", status: 400 },
} as const satisfies HttpErrorDefinitions<RequestPasswordRecoveryError["code"]>;

export const ResetRecoveredPasswordHttpErrors = {
  "password_recovery.invalid_token": {
    code: "password_recovery.invalid_token",
    status: 400,
  },
  "password.confirmation_mismatch": {
    code: "password.confirmation_mismatch",
    status: 400,
  },
  "password.reused": { code: "password.reused", status: 400 },
  "password.empty": { code: "password.empty", status: 400 },
  "password.too_short": { code: "password.too_short", status: 400 },
  "password.too_long": { code: "password.too_long", status: 400 },
  "password.too_common": { code: "password.too_common", status: 400 },
  "password.compromised": { code: "password.compromised", status: 400 },
  "password.contextual": { code: "password.contextual", status: 400 },
  "password.too_weak": { code: "password.too_weak", status: 400 },
  "password.uppercase_required": {
    code: "password.uppercase_required",
    status: 400,
  },
  "password.lowercase_required": {
    code: "password.lowercase_required",
    status: 400,
  },
  "password.number_required": { code: "password.number_required", status: 400 },
  "password.special_character_required": {
    code: "password.special_character_required",
    status: 400,
  },
} as const satisfies HttpErrorDefinitions<ResetRecoveredPasswordError["code"]>;

export const CompleteMfaSignInHttpErrors = {
  ...factorVerificationErrors,
} as const satisfies HttpErrorDefinitions<CompleteMfaSignInError["code"]>;

export const CancelAccountDeletionHttpErrors = {
  ...factorVerificationErrors,
  "authentication.invalid_credentials": {
    code: "authentication.invalid_credentials",
    status: 401,
  },
  "account_deletion.invalid_token": {
    code: "account_deletion.invalid_token",
    status: 400,
  },
  "mfa.code_required": { code: "mfa.code_required", status: 400 },
} as const satisfies HttpErrorDefinitions<CancelAccountDeletionError["code"]>;

export const BeginMfaEnrollmentHttpErrors = {
  ...recentAuthenticationErrors,
  "mfa.unavailable": { code: "mfa.unavailable", status: 403 },
  "user.not_found": { code: "user.not_found", status: 404 },
  "mfa.already_enabled": { code: "mfa.already_enabled", status: 409 },
} as const satisfies HttpErrorDefinitions<BeginMfaEnrollmentError["code"]>;

export const ConfirmMfaEnrollmentHttpErrors = {
  "mfa.invalid_enrollment": { code: "mfa.invalid_enrollment", status: 400 },
  "mfa.invalid_code": { code: "mfa.invalid_code", status: 400 },
} as const satisfies HttpErrorDefinitions<ConfirmMfaEnrollmentError["code"]>;

export const ActivateMfaHttpErrors = {
  "mfa.invalid_enrollment": { code: "mfa.invalid_enrollment", status: 400 },
  "mfa.backup_codes_confirmation_required": {
    code: "mfa.backup_codes_confirmation_required",
    status: 400,
  },
} as const satisfies HttpErrorDefinitions<ActivateMfaError["code"]>;

export const RegenerateMfaBackupCodesHttpErrors = {
  ...recentAuthenticationErrors,
  ...factorVerificationErrors,
} as const satisfies HttpErrorDefinitions<
  RegenerateMfaBackupCodesError["code"]
>;

export const DisableMfaHttpErrors = {
  ...recentAuthenticationErrors,
  ...factorVerificationErrors,
  "user.not_found": { code: "user.not_found", status: 404 },
  "mfa.required_by_policy": { code: "mfa.required_by_policy", status: 409 },
  "account.concurrent_modification": {
    code: "account.concurrent_modification",
    status: 409,
  },
} as const satisfies HttpErrorDefinitions<DisableMfaError["code"]>;

export const RequestAccountExportHttpErrors = {
  ...strongAuthenticationErrors,
  "user.not_found": { code: "user.not_found", status: 404 },
  "account_export.disabled": { code: "account_export.disabled", status: 403 },
} as const satisfies HttpErrorDefinitions<RequestAccountExportError["code"]>;

export const DownloadAccountExportHttpErrors = {
  "account_export.not_available": {
    code: "account_export.not_available",
    status: 404,
  },
} as const satisfies HttpErrorDefinitions<DownloadAccountExportError["code"]>;

export const RequestAccountDeletionHttpErrors = {
  ...strongAuthenticationErrors,
  "user.not_found": { code: "user.not_found", status: 404 },
  "account.concurrent_modification": {
    code: "account.concurrent_modification",
    status: 409,
  },
  "account_deletion.disabled": {
    code: "account_deletion.disabled",
    status: 403,
  },
  "account_deletion.confirmation_required": {
    code: "account_deletion.confirmation_required",
    status: 400,
  },
  "administrator.last_active_access": {
    code: "administrator.last_active_access",
    status: 409,
  },
} as const satisfies HttpErrorDefinitions<RequestAccountDeletionError["code"]>;

export const GetSecurityConfigurationHttpErrors = {
  "administrator.unauthorized": {
    code: "administrator.unauthorized",
    status: 403,
  },
} as const satisfies HttpErrorDefinitions<
  GetSecurityConfigurationError["code"]
>;

export const PreviewSecurityConfigurationHttpErrors = {
  ...GetSecurityConfigurationHttpErrors,
  "security_configuration.invalid": {
    code: "security_configuration.invalid",
    status: 400,
  },
} as const satisfies HttpErrorDefinitions<
  PreviewSecurityConfigurationError["code"]
>;

export const PublishSecurityConfigurationHttpErrors = {
  ...strongAuthenticationErrors,
  ...GetSecurityConfigurationHttpErrors,
  "security_configuration.invalid": {
    code: "security_configuration.invalid",
    status: 400,
  },
  "security_configuration.justification_required": {
    code: "security_configuration.justification_required",
    status: 400,
  },
  "security_configuration.critical_confirmation_required": {
    code: "security_configuration.critical_confirmation_required",
    status: 409,
  },
  "security_configuration.version_conflict": {
    code: "security_configuration.version_conflict",
    status: 409,
  },
  "administrator.last_active_access": {
    code: "administrator.last_active_access",
    status: 409,
  },
} as const satisfies HttpErrorDefinitions<
  PublishSecurityConfigurationError["code"]
>;

export const RestoreSecurityConfigurationHttpErrors = {
  ...PublishSecurityConfigurationHttpErrors,
  "security_configuration.revision_not_found": {
    code: "security_configuration.revision_not_found",
    status: 404,
  },
} as const satisfies HttpErrorDefinitions<
  RestoreSecurityConfigurationError["code"]
>;
