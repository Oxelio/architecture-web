import { describe, expect, it } from "vitest";

import i18n from "#app/i18n";
import { ApiRequestError } from "#services/api";

import { apiErrorKey, errorMessage, fieldErrorMessage } from "./error-feedback";

it("uses localized fallback when only the other language has the specific message", () => {
  const instance = i18n.cloneInstance({ forkResourceStore: true });
  instance.addResource(
    "fr",
    "translation",
    "errorFeedback.onlyFrench",
    "Un message spécifique",
  );

  expect(
    errorMessage(instance.getFixedT("en"), "errorFeedback.onlyFrench"),
  ).toBe("The operation failed. Please try again later.");
});

describe.each(["fr", "en"] as const)("error feedback in %s", (locale) => {
  const t = i18n.getFixedT(locale);

  it.each([
    ["signUp", "password.too_weak", "phrase de passe", "passphrase"],
    ["signUp", "password.too_common", "trop courant", "too common"],
    [
      "signUp",
      "password.compromised",
      "données compromises",
      "compromised data",
    ],
    ["signUp", "password.too_short", "trop court", "too short"],
    ["signUp", "password.too_long", "trop long", "too long"],
    ["signUp", "password.contextual", "liées au compte", "account-specific"],
    ["signUp", "password.uppercase_required", "majuscule", "uppercase"],
    ["signUp", "password.number_required", "chiffre", "number"],
    ["signUp", "user.already_exists", "identifiant", "identifier"],
    [
      "resetPassword",
      "password_recovery.invalid_token",
      "récupération",
      "recovery link",
    ],
    ["resetPassword", "password.reused", "différent", "differ"],
    [
      "resetPassword",
      "password_recovery.invalid_request",
      "Saisissez le nouveau mot de passe et sa confirmation.",
      "Enter and confirm your new password.",
    ],
    ["changeEmail", "email_change.disabled", "désactivée", "disabled"],
    [
      "changePassword",
      "password.current_invalid",
      "actuel",
      "current password",
    ],
    [
      "resendVerification",
      "email_verification.too_many_requests",
      "Attendez",
      "Wait",
    ],
    [
      "adminUser",
      "user.self_administration_forbidden",
      "propre compte",
      "your own account",
    ],
    [
      "adminSessions",
      "session.not_found",
      "session n’est plus disponible",
      "session is no longer available",
    ],
    [
      "securityConfig",
      "security_configuration.version_conflict",
      "Actualisez-la",
      "Refresh it",
    ],
    [
      "securityConfig",
      "security_configuration.invalid",
      "Vérifiez les paramètres",
      "Check the configuration",
    ],
  ] as const)("localizes %s failure %s", (operation, code, fr, en) => {
    const text = errorMessage(
      t,
      apiErrorKey(new ApiRequestError(code), operation),
    );
    expect(text).toContain(locale === "fr" ? fr : en);
    expect(text).not.toContain(code);
  });

  it.each([
    new ApiRequestError("password.new_policy_code"),
    new ApiRequestError("__proto__"),
    new Error("password.too_weak"),
    new Error("unexpected: confidential diagnostic details"),
    { message: "opaque failure" },
  ])("safely renders unrecognized failures", (error) => {
    expect(errorMessage(t, apiErrorKey(error, "signUp"))).toContain(
      locale === "fr" ? "Réessaie plus tard" : "Please try again later",
    );
  });

  it("falls back in the active locale for an absent translation or unknown field identity", () => {
    expect(errorMessage(t, "errorFeedback.missing")).toBe(
      locale === "fr"
        ? "L’opération a échoué. Réessayez plus tard."
        : "The operation failed. Please try again later.",
    );
    expect(fieldErrorMessage(t, "raw validation exception")).toBe(
      locale === "fr"
        ? "Vérifiez la valeur de ce champ."
        : "Check the value in this field.",
    );
  });

  it.each([
    [
      "signIn",
      [
        "authentication.invalid_credentials",
        "user.suspended",
        "user.not_found",
        "mfa.enrollment_required",
      ],
    ],
    [
      "mfa",
      [
        "mfa.invalid_challenge",
        "mfa.invalid_code",
        "mfa.not_enabled",
        "user.not_found",
      ],
    ],
    [
      "requestRecovery",
      [
        "user.not_found",
        "user.suspended",
        "password.too_weak",
        "password_recovery.invalid_token",
      ],
    ],
    [
      "verifyEmail",
      [
        "email_verification.invalid_token",
        "email_verification.expired_token",
        "user.not_found",
      ],
    ],
  ] as const)("masks sensitive distinctions in %s", (operation, codes) => {
    const messages = codes.map((code) =>
      errorMessage(t, apiErrorKey(new ApiRequestError(code), operation)),
    );
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).not.toMatch(
      /not found|introuvable|suspend|enrollment/u,
    );
  });
});
