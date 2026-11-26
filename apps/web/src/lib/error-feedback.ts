import type { TFunction } from "i18next";

import { ApiRequestError } from "#services/api";

const passwordErrors = {
  "password.empty": "passwordFeedback.empty",
  "password.confirmation_mismatch": "passwordFeedback.confirmation_mismatch",
  "password.too_short": "passwordFeedback.too_short",
  "password.too_long": "passwordFeedback.too_long",
  "password.too_common": "passwordFeedback.too_common",
  "password.compromised": "passwordFeedback.compromised",
  "password.contextual": "passwordFeedback.contextual",
  "password.too_weak": "passwordFeedback.too_weak",
  "password.uppercase_required": "passwordFeedback.uppercase_required",
  "password.lowercase_required": "passwordFeedback.lowercase_required",
  "password.number_required": "passwordFeedback.number_required",
  "password.special_character_required":
    "passwordFeedback.special_character_required",
  "password.policy_violation": "passwordFeedback.invalid",
};

const sessionErrors = {
  "session_management.disabled": "errorFeedback.sessionManagementDisabled",
  "session.not_found": "errorFeedback.sessionNotFound",
};

const incompleteRecoveryFormKey = "passwordFeedback.recovery_invalid_request";

const apiFeedback: Record<
  | "signIn"
  | "mfa"
  | "signUp"
  | "requestRecovery"
  | "resetPassword"
  | "verifyEmail"
  | "changeEmail"
  | "changePassword"
  | "resendVerification"
  | "profileSessions"
  | "adminUser"
  | "adminSessions"
  | "securityConfig",
  { fallback: string; codes: Readonly<Record<string, string>> }
> = {
  signIn: {
    fallback: "auth.signInError",
    // Authentication failures share one message across account and credential states.
    codes: {
      "authentication.invalid_credentials": "auth.signInError",
      "user.suspended": "auth.signInError",
      "mfa.invalid_challenge": "auth.signInError",
      "mfa.enrollment_required": "auth.signInError",
    },
  },
  mfa: {
    fallback: "auth.mfaError",
    codes: {
      "mfa.invalid_challenge": "auth.mfaError",
      "mfa.invalid_code": "auth.mfaError",
      "mfa.not_enabled": "auth.mfaError",
    },
  },
  signUp: {
    fallback: "auth.signUpError",
    codes: {
      ...passwordErrors,
      "login_identifier.empty": "auth.identifierRequired",
      "login_identifier.invalid_email": "auth.invalidEmail",
      "login_identifier.invalid_username": "auth.invalidUsername",
      "login_identifier.invalid_kind": "auth.identifierNotAllowed",
      "login_identifier.not_allowed": "auth.identifierNotAllowed",
      "registration.disabled": "auth.signUpUnavailable",
      "user.already_exists": "auth.accountAlreadyExists",
    },
  },
  requestRecovery: {
    fallback: "passwordFeedback.unavailable",
    codes: { "email.invalid_format": "auth.invalidEmail" },
  },
  resetPassword: {
    fallback: "passwordFeedback.unavailable",
    codes: {
      ...passwordErrors,
      "password.reused": "passwordFeedback.reused",
      "password_recovery.invalid_token": "passwordFeedback.recovery_invalid",
      "password_recovery.invalid_request": incompleteRecoveryFormKey,
    },
  },
  verifyEmail: {
    fallback: "verify.error",
    codes: {
      "email_verification.invalid_token": "verify.invalidLink",
      "email_verification.expired_token": "verify.invalidLink",
      "user.not_found": "verify.invalidLink",
    },
  },
  changeEmail: {
    fallback: "profile.emailUpdateError",
    codes: {
      "email.invalid_format": "auth.invalidEmail",
      "login_identifier.invalid_email": "auth.invalidEmail",
      "email_change.disabled": "errorFeedback.emailChangeDisabled",
      "user.already_exists": "errorFeedback.emailAlreadyUsed",
      "administrator.last_active_access": "errorFeedback.lastAdministrator",
    },
  },
  changePassword: {
    fallback: "profile.passwordUpdateError",
    codes: {
      ...passwordErrors,
      "password.reused": "passwordFeedback.reused",
      "password.current_invalid": "passwordFeedback.currentInvalid",
    },
  },
  resendVerification: {
    fallback: "profile.verificationEmailError",
    codes: {
      "email_verification.already_verified": "profile.emailVerified",
      "email_verification.too_many_requests": "errorFeedback.verificationRate",
    },
  },
  profileSessions: {
    fallback: "profile.sessionsError",
    codes: sessionErrors,
  },
  adminUser: {
    fallback: "admin.error",
    codes: {
      "user.not_found": "errorFeedback.adminUserNotFound",
      "user.self_administration_forbidden": "errorFeedback.adminSelfOperation",
      "administrator.last_active_access": "errorFeedback.lastAdministrator",
    },
  },
  adminSessions: {
    fallback: "admin.sessionsError",
    codes: sessionErrors,
  },
  securityConfig: {
    fallback: "securityConfig.error",
    codes: {
      "administrator.unauthorized": "securityConfig.administratorRequired",
      "authentication.unauthorized": "securityConfig.sessionExpired",
      "authorization.forbidden": "securityConfig.administratorRequired",
      "security_configuration.confirmation_refused":
        "securityConfig.confirmationRefused",
      "security_configuration.confirmation_attempts_exhausted":
        "securityConfig.confirmationAttemptsExhausted",
      "security_configuration.invalid": "securityConfig.invalid",
      "security_configuration.justification_required":
        "securityConfig.justificationRequired",
      "security_configuration.critical_confirmation_required":
        "securityConfig.confirmationRequired",
      "security_configuration.version_conflict":
        "securityConfig.versionConflict",
      "security_configuration.revision_not_found":
        "securityConfig.revisionMissing",
      "administrator.last_active_access": "errorFeedback.lastAdministrator",
      "authentication.recent_proof_required":
        "securityConfig.recentAuthenticationRequired",
      "authentication.invalid_credentials":
        "securityConfig.authenticationFailed",
      "mfa.code_required": "securityConfig.authenticationFailed",
      "mfa.invalid_code": "securityConfig.authenticationFailed",
      "mfa.invalid_challenge": "securityConfig.authenticationFailed",
      "mfa.not_enabled": "securityConfig.authenticationFailed",
    },
  },
};

export function apiErrorKey(
  error: unknown,
  operation: keyof typeof apiFeedback,
) {
  const { codes, fallback } = apiFeedback[operation];
  if (error instanceof ApiRequestError && Object.hasOwn(codes, error.code)) {
    return codes[error.code] ?? fallback;
  }
  return fallback;
}

export function errorMessage(
  t: TFunction,
  key: string,
  count?: number,
): string {
  return t(key, {
    fallbackLng: false,
    defaultValue: t("errorFeedback.unexpected"),
    ...(count === undefined ? {} : { count }),
  });
}

export function fieldErrorMessage(t: TFunction, identity: string | undefined) {
  switch (identity) {
    case "auth.identifierRequired":
    case "auth.invalidEmail":
    case "auth.invalidUsername":
    case "auth.passwordConfirmationMismatch":
      return errorMessage(t, identity);
  }

  const bound = /^(auth\.password(?:Min|Max)):(\d+)$/u.exec(identity ?? "");
  if (bound) {
    return errorMessage(t, bound[1], Number(bound[2]));
  }
  return errorMessage(t, "errorFeedback.invalidField");
}
