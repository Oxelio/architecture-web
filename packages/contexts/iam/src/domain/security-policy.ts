import { Result } from "@architecture/foundation";

import {
  type PasswordSecurityLevel,
  type PasswordStrength,
  PasswordStrengths,
} from "./password-policy.js";
export interface SecurityPolicy {
  accounts: {
    publicRegistration: boolean;
    allowedLoginIdentifiers: ("username" | "email")[];
    emailVerification: boolean;
    emailChange: boolean;
    export: boolean;
    deletion: boolean;
    deletionGraceDays: number;
  };
  authentication: {
    mfaAvailable: boolean;
    mfaRequiredRoles: ("user" | "admin")[];
    mfaChallengeMinutes: number;
    mfaMaxAttempts: number;
    recentAuthenticationMinutes: number;
  };
  passwords: {
    standardLevel: PasswordSecurityLevel;
    privilegedLevel: PasswordSecurityLevel;
    standardMinLength: number;
    privilegedMinLength: number;
    maxLength: number;
    standardMinimumStrength: PasswordStrength;
    privilegedMinimumStrength: PasswordStrength;
    checkCommonPasswords: boolean;
    checkCompromisedPasswords: boolean;
    checkUserContext: boolean;
    rejectCurrentPassword: boolean;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecialCharacter: boolean;
  };
  sessions: { userManagement: boolean; durationMinutes: number };
  recovery: { enabled: boolean; tokenMinutes: number; requestsPerHour: number };
  audit: { consultation: boolean; retentionDays: number };
}
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  accounts: {
    publicRegistration: true,
    allowedLoginIdentifiers: ["username", "email"],
    emailVerification: true,
    emailChange: true,
    export: true,
    deletion: true,
    deletionGraceDays: 14,
  },
  authentication: {
    mfaAvailable: true,
    mfaRequiredRoles: [],
    mfaChallengeMinutes: 5,
    mfaMaxAttempts: 5,
    recentAuthenticationMinutes: 15,
  },
  passwords: {
    standardLevel: "elevated",
    privilegedLevel: "critical",
    standardMinLength: 15,
    privilegedMinLength: 20,
    maxLength: 128,
    standardMinimumStrength: "acceptable",
    privilegedMinimumStrength: "strong",
    checkCommonPasswords: true,
    checkCompromisedPasswords: true,
    checkUserContext: true,
    rejectCurrentPassword: true,
    requireUppercase: false,
    requireLowercase: false,
    requireNumber: false,
    requireSpecialCharacter: false,
  },
  sessions: { userManagement: true, durationMinutes: 60 * 24 * 30 },
  recovery: { enabled: true, tokenMinutes: 30, requestsPerHour: 5 },
  audit: { consultation: true, retentionDays: 365 },
};

const bounds: Record<string, readonly [number, number]> = {
  "accounts.deletionGraceDays": [1, 90],
  "authentication.mfaChallengeMinutes": [1, 30],
  "authentication.mfaMaxAttempts": [3, 20],
  "authentication.recentAuthenticationMinutes": [1, 60],
  "passwords.standardMinLength": [8, 128],
  "passwords.privilegedMinLength": [12, 128],
  "passwords.maxLength": [64, 512],
  "sessions.durationMinutes": [5, 525600],
  "recovery.tokenMinutes": [5, 1440],
  "recovery.requestsPerHour": [1, 20],
  "audit.retentionDays": [30, 3650],
};
/** Validates a complete snapshot. No defaults are merged into published values. */
export function parseSecurityPolicy(
  input: unknown,
): Result<SecurityPolicy, { code: "CONFIG_INVALID" }> {
  const invalid = () => Result.failure({ code: "CONFIG_INVALID" } as const);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid();
  }
  const candidate = input as Record<string, unknown>;
  if (
    Object.keys(candidate).some(
      (key) => !Object.hasOwn(DEFAULT_SECURITY_POLICY, key),
    )
  ) {
    return invalid();
  }
  for (const [category, defaults] of Object.entries(DEFAULT_SECURITY_POLICY)) {
    const values = candidate[category];
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return invalid();
    }
    const fields = values as Record<string, unknown>;
    if (Object.keys(fields).some((key) => !Object.hasOwn(defaults, key))) {
      return invalid();
    }
    for (const [key, example] of Object.entries(defaults)) {
      const value = fields[key];
      const name = `${category}.${key}`;
      if (Array.isArray(example)) {
        const choices =
          name === "accounts.allowedLoginIdentifiers"
            ? ["username", "email"]
            : ["user", "admin"];
        if (
          !Array.isArray(value) ||
          value.some((item) => !choices.includes(item)) ||
          new Set(value).size !== value.length ||
          (name === "accounts.allowedLoginIdentifiers" && value.length === 0)
        ) {
          return invalid();
        }
      } else if (typeof example === "number") {
        const limit = bounds[name];
        if (
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          !limit ||
          value < limit[0] ||
          value > limit[1]
        ) {
          return invalid();
        }
      } else if (typeof example === "boolean") {
        if (typeof value !== "boolean") {
          return invalid();
        }
      } else {
        const choices = key.endsWith("Level")
          ? ["standard", "elevated", "critical", "custom"]
          : PasswordStrengths;
        if (
          typeof value !== "string" ||
          !(choices as readonly string[]).includes(value)
        ) {
          return invalid();
        }
      }
    }
  }
  const policy = structuredClone(input) as SecurityPolicy;
  if (
    (policy.authentication.mfaRequiredRoles.length > 0 &&
      !policy.authentication.mfaAvailable) ||
    policy.passwords.privilegedMinLength < policy.passwords.standardMinLength ||
    policy.passwords.maxLength < policy.passwords.privilegedMinLength
  ) {
    return invalid();
  }
  return Result.success(policy);
}
export function changedPolicyKeys(
  before: unknown,
  after: unknown,
  prefix = "",
): string[] {
  if (Array.isArray(before) || Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix];
  }
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object"
  ) {
    return before === after ? [] : [prefix];
  }
  const first = before as Record<string, unknown>,
    second = after as Record<string, unknown>;
  return [...new Set([...Object.keys(first), ...Object.keys(second)])].flatMap(
    (key) =>
      changedPolicyKeys(
        first[key],
        second[key],
        prefix ? `${prefix}.${key}` : key,
      ),
  );
}

export const CRITICAL_SECURITY_POLICY_KEYS: readonly string[] = [
  "accounts.deletion",
  "accounts.deletionGraceDays",
  "authentication.mfaRequiredRoles",
  "passwords.privilegedLevel",
  "passwords.privilegedMinLength",
  "passwords.privilegedMinimumStrength",
  "audit.retentionDays",
];
export function policyValue(policy: SecurityPolicy, key: string): unknown {
  return key.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    return (value as Record<string, unknown>)[segment];
  }, policy);
}

/** Historical decoding is separate from strict validation of new publications.
 * v1 permitted a missing identifier set (email only) and duplicate set members.
 * Unknown keys remain errors; the stored document is never rewritten.
 */
export function parseStoredSecurityPolicy(
  input: unknown,
  representationVersion: number,
) {
  if (representationVersion === 2) {
    return parseSecurityPolicy(input);
  }
  if (
    representationVersion !== 1 ||
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    return parseSecurityPolicy(null);
  }
  const legacy = structuredClone(input) as Record<
    string,
    Record<string, unknown>
  >;
  if (
    legacy["accounts"] &&
    !Object.hasOwn(legacy["accounts"], "allowedLoginIdentifiers")
  ) {
    legacy["accounts"]["allowedLoginIdentifiers"] = ["email"];
  }
  for (const [section, key] of [
    ["accounts", "allowedLoginIdentifiers"],
    ["authentication", "mfaRequiredRoles"],
  ] as const) {
    const fields = legacy[section];
    const values = fields?.[key];
    if (fields && Array.isArray(values)) {
      fields[key] = [...new Set(values)];
    }
  }
  return parseSecurityPolicy(legacy);
}
