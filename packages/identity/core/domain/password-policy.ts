export const PasswordStrengths = [
  "too_weak",
  "weak",
  "acceptable",
  "strong",
  "very_strong",
] as const;

export type PasswordStrength = (typeof PasswordStrengths)[number];
export type PasswordSecurityLevel =
  "standard" | "elevated" | "critical" | "custom";

export interface PasswordCompositionRules {
  readonly requireUppercase: boolean;
  readonly requireLowercase: boolean;
  readonly requireNumber: boolean;
  readonly requireSpecialCharacter: boolean;
}

export interface PasswordPolicy {
  readonly level: PasswordSecurityLevel;
  readonly minLength: number;
  readonly maxLength: number;
  readonly minimumStrength: PasswordStrength;
  readonly checkCommonPasswords: boolean;
  readonly checkCompromisedPasswords: boolean;
  readonly checkUserContext: boolean;
  readonly rejectCurrentPassword: boolean;
  readonly composition: PasswordCompositionRules;
}

export type PasswordPolicyOverrides = Partial<
  Omit<PasswordPolicy, "level" | "composition">
> & {
  readonly composition?: Partial<PasswordCompositionRules>;
};

const defaultComposition: PasswordCompositionRules = {
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSpecialCharacter: false,
};

const presets: Record<
  Exclude<PasswordSecurityLevel, "custom">,
  Omit<PasswordPolicy, "level">
> = {
  standard: {
    minLength: 12,
    maxLength: 128,
    minimumStrength: "weak",
    checkCommonPasswords: true,
    checkCompromisedPasswords: true,
    checkUserContext: false,
    rejectCurrentPassword: true,
    composition: defaultComposition,
  },
  elevated: {
    minLength: 15,
    maxLength: 128,
    minimumStrength: "acceptable",
    checkCommonPasswords: true,
    checkCompromisedPasswords: true,
    checkUserContext: true,
    rejectCurrentPassword: true,
    composition: defaultComposition,
  },
  critical: {
    minLength: 20,
    maxLength: 128,
    minimumStrength: "strong",
    checkCommonPasswords: true,
    checkCompromisedPasswords: true,
    checkUserContext: true,
    rejectCurrentPassword: true,
    composition: defaultComposition,
  },
};

export function createPasswordPolicy(
  level: PasswordSecurityLevel = "elevated",
  overrides: PasswordPolicyOverrides = {},
): PasswordPolicy {
  const base = level === "custom" ? presets.elevated : presets[level];
  const policy: PasswordPolicy = {
    ...base,
    ...overrides,
    level,
    composition: {
      ...base.composition,
      ...overrides.composition,
    },
  };

  if (policy.minLength < 1 || policy.maxLength < 64) {
    throw new Error(
      "Password policy must require a positive minimum and accept at least 64 Unicode code points",
    );
  }
  if (policy.minLength > policy.maxLength) {
    throw new Error(
      "Password policy minimum length cannot exceed its maximum length",
    );
  }

  return Object.freeze({
    ...policy,
    composition: Object.freeze(policy.composition),
  });
}

export function comparePasswordStrength(
  left: PasswordStrength,
  right: PasswordStrength,
): number {
  return PasswordStrengths.indexOf(left) - PasswordStrengths.indexOf(right);
}
