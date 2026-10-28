import type { SecurityPolicy } from "@architecture/iam/application";
export type SecurityConfigControl =
  "switch" | "number" | "slider-number" | "select" | "multi-select";

export interface SecurityConfigCatalogEntry {
  readonly key: string;
  readonly category: keyof SecurityPolicy;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly control: SecurityConfigControl;
  readonly type: "boolean" | "integer" | "duration" | "choice" | "set";
  readonly impact: "medium" | "high" | "critical";
  readonly constraints?: {
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly unit?: "minutes" | "days" | "characters" | "attempts" | "requests";
    readonly choices?: readonly string[];
  };
  readonly recommendedValue: unknown;
  readonly availability: {
    readonly available: boolean;
    readonly readOnly: boolean;
    readonly reason?: string;
  };
}

const entry = (
  value: Omit<
    SecurityConfigCatalogEntry,
    "labelKey" | "descriptionKey" | "availability"
  > & {
    availability?: SecurityConfigCatalogEntry["availability"];
  },
): SecurityConfigCatalogEntry => ({
  ...value,
  labelKey: `securityConfig.fields.${value.key}.label`,
  descriptionKey: `securityConfig.fields.${value.key}.description`,
  availability: value.availability ?? { available: true, readOnly: false },
});

export const SECURITY_CONFIG_CATALOG: readonly SecurityConfigCatalogEntry[] = [
  entry({
    key: "accounts.publicRegistration",
    category: "accounts",
    control: "switch",
    type: "boolean",
    impact: "medium",
    recommendedValue: true,
  }),
  entry({
    key: "accounts.allowedLoginIdentifiers",
    category: "accounts",
    control: "multi-select",
    type: "set",
    impact: "high",
    constraints: { choices: ["username", "email"] },
    recommendedValue: ["username", "email"],
  }),
  entry({
    key: "accounts.emailVerification",
    category: "accounts",
    control: "switch",
    type: "boolean",
    impact: "high",
    recommendedValue: true,
  }),
  entry({
    key: "accounts.emailChange",
    category: "accounts",
    control: "switch",
    type: "boolean",
    impact: "high",
    recommendedValue: true,
  }),
  entry({
    key: "accounts.export",
    category: "accounts",
    control: "switch",
    type: "boolean",
    impact: "medium",
    recommendedValue: true,
  }),
  entry({
    key: "accounts.deletion",
    category: "accounts",
    control: "switch",
    type: "boolean",
    impact: "critical",
    recommendedValue: true,
  }),
  entry({
    key: "accounts.deletionGraceDays",
    category: "accounts",
    control: "slider-number",
    type: "duration",
    impact: "critical",
    constraints: { min: 1, max: 90, step: 1, unit: "days" },
    recommendedValue: 14,
  }),
  entry({
    key: "authentication.mfaAvailable",
    category: "authentication",
    control: "switch",
    type: "boolean",
    impact: "high",
    recommendedValue: true,
  }),
  entry({
    key: "authentication.mfaRequiredRoles",
    category: "authentication",
    control: "multi-select",
    type: "set",
    impact: "critical",
    constraints: { choices: ["user", "admin"] },
    recommendedValue: [],
  }),
  entry({
    key: "authentication.mfaChallengeMinutes",
    category: "authentication",
    control: "slider-number",
    type: "duration",
    impact: "high",
    constraints: { min: 1, max: 30, step: 1, unit: "minutes" },
    recommendedValue: 5,
  }),
  entry({
    key: "authentication.mfaMaxAttempts",
    category: "authentication",
    control: "slider-number",
    type: "integer",
    impact: "high",
    constraints: { min: 3, max: 20, step: 1, unit: "attempts" },
    recommendedValue: 5,
  }),
  entry({
    key: "authentication.recentAuthenticationMinutes",
    category: "authentication",
    control: "slider-number",
    type: "duration",
    impact: "high",
    constraints: { min: 1, max: 60, step: 1, unit: "minutes" },
    recommendedValue: 15,
  }),
  entry({
    key: "passwords.standardLevel",
    category: "passwords",
    control: "select",
    type: "choice",
    impact: "high",
    constraints: {
      choices: ["standard", "elevated", "critical", "custom"],
    },
    recommendedValue: "elevated",
  }),
  entry({
    key: "passwords.privilegedLevel",
    category: "passwords",
    control: "select",
    type: "choice",
    impact: "critical",
    constraints: {
      choices: ["standard", "elevated", "critical", "custom"],
    },
    recommendedValue: "critical",
  }),
  entry({
    key: "passwords.standardMinLength",
    category: "passwords",
    control: "slider-number",
    type: "integer",
    impact: "high",
    constraints: { min: 8, max: 128, step: 1, unit: "characters" },
    recommendedValue: 15,
  }),
  entry({
    key: "passwords.privilegedMinLength",
    category: "passwords",
    control: "slider-number",
    type: "integer",
    impact: "critical",
    constraints: { min: 12, max: 128, step: 1, unit: "characters" },
    recommendedValue: 20,
  }),
  entry({
    key: "passwords.maxLength",
    category: "passwords",
    control: "number",
    type: "integer",
    impact: "high",
    constraints: { min: 64, max: 512, step: 1, unit: "characters" },
    recommendedValue: 128,
  }),
  entry({
    key: "passwords.standardMinimumStrength",
    category: "passwords",
    control: "select",
    type: "choice",
    impact: "high",
    constraints: {
      choices: ["too_weak", "weak", "acceptable", "strong", "very_strong"],
    },
    recommendedValue: "acceptable",
  }),
  entry({
    key: "passwords.privilegedMinimumStrength",
    category: "passwords",
    control: "select",
    type: "choice",
    impact: "critical",
    constraints: {
      choices: ["too_weak", "weak", "acceptable", "strong", "very_strong"],
    },
    recommendedValue: "strong",
  }),
  ...[
    "checkCommonPasswords",
    "checkCompromisedPasswords",
    "checkUserContext",
    "rejectCurrentPassword",
    "requireUppercase",
    "requireLowercase",
    "requireNumber",
    "requireSpecialCharacter",
  ].map((name) =>
    entry({
      key: `passwords.${name}`,
      category: "passwords",
      control: "switch",
      type: "boolean",
      impact: "high",
      recommendedValue: !name.startsWith("require"),
    }),
  ),
  entry({
    key: "sessions.userManagement",
    category: "sessions",
    control: "switch",
    type: "boolean",
    impact: "medium",
    recommendedValue: true,
  }),
  entry({
    key: "sessions.durationMinutes",
    category: "sessions",
    control: "number",
    type: "duration",
    impact: "high",
    constraints: { min: 5, max: 525_600, step: 5, unit: "minutes" },
    recommendedValue: 43_200,
  }),
  entry({
    key: "recovery.enabled",
    category: "recovery",
    control: "switch",
    type: "boolean",
    impact: "high",
    recommendedValue: true,
  }),
  entry({
    key: "recovery.tokenMinutes",
    category: "recovery",
    control: "slider-number",
    type: "duration",
    impact: "high",
    constraints: { min: 5, max: 1440, step: 5, unit: "minutes" },
    recommendedValue: 30,
  }),
  entry({
    key: "recovery.requestsPerHour",
    category: "recovery",
    control: "slider-number",
    type: "integer",
    impact: "high",
    constraints: { min: 1, max: 20, step: 1, unit: "requests" },
    recommendedValue: 5,
  }),
  entry({
    key: "audit.consultation",
    category: "audit",
    control: "switch",
    type: "boolean",
    impact: "medium",
    recommendedValue: true,
  }),
  entry({
    key: "audit.retentionDays",
    category: "audit",
    control: "number",
    type: "duration",
    impact: "critical",
    constraints: { min: 30, max: 3650, step: 30, unit: "days" },
    recommendedValue: 365,
  }),
];
