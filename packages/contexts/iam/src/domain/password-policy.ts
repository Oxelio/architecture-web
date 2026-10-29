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
  if (!["standard", "elevated", "critical", "custom"].includes(level)) {
    throw new Error("Unknown password security level");
  }
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

  if (
    !Number.isSafeInteger(policy.minLength) ||
    !Number.isSafeInteger(policy.maxLength) ||
    policy.maxLength > 1024 ||
    !PasswordStrengths.includes(policy.minimumStrength)
  ) {
    throw new Error("Invalid password policy bounds or strength");
  }
  if (
    [
      policy.checkCommonPasswords,
      policy.checkCompromisedPasswords,
      policy.checkUserContext,
      policy.rejectCurrentPassword,
      ...Object.values(policy.composition),
    ].some((value) => typeof value !== "boolean")
  ) {
    throw new Error("Password policy switches must be booleans");
  }
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

export type PasswordPolicyProfile = "standard" | "privileged";
export function selectPasswordPolicyProfile(role: {
  isAdmin(): boolean;
}): PasswordPolicyProfile {
  return role.isAdmin() ? "privileged" : "standard";
}

export interface PasswordContext {
  readonly email?: string;
  readonly username?: string;
  readonly displayName?: string;
  readonly applicationName?: string;
  readonly organizationName?: string;
}
export type PasswordPolicyViolation =
  | { readonly code: "password.empty" }
  | {
      readonly code: "password.too_short";
      readonly actual: number;
      readonly min: number;
    }
  | {
      readonly code: "password.too_long";
      readonly actual: number;
      readonly max: number;
    }
  | { readonly code: "password.too_common" }
  | { readonly code: "password.compromised" }
  | { readonly code: "password.contextual" }
  | { readonly code: "password.too_weak" }
  | { readonly code: "password.uppercase_required" }
  | { readonly code: "password.lowercase_required" }
  | { readonly code: "password.number_required" }
  | { readonly code: "password.special_character_required" };

export function evaluatePasswordRules(
  policy: PasswordPolicy,
  input: { password: string; context?: PasswordContext },
): PasswordPolicyViolation[] {
  const errors: PasswordPolicyViolation[] = [];
  const length = [...input.password].length;
  if (length === 0) {
    errors.push({ code: "password.empty" });
  } else if (length < policy.minLength) {
    errors.push({
      code: "password.too_short",
      actual: length,
      min: policy.minLength,
    });
  }
  if (length > policy.maxLength) {
    errors.push({
      code: "password.too_long",
      actual: length,
      max: policy.maxLength,
    });
  }

  const { composition } = policy;
  if (composition.requireUppercase && !/\p{Lu}/u.test(input.password)) {
    errors.push({ code: "password.uppercase_required" });
  }
  if (composition.requireLowercase && !/\p{Ll}/u.test(input.password)) {
    errors.push({ code: "password.lowercase_required" });
  }
  if (composition.requireNumber && !/\p{N}/u.test(input.password)) {
    errors.push({ code: "password.number_required" });
  }
  if (
    composition.requireSpecialCharacter &&
    !/[^\p{L}\p{N}]/u.test(input.password)
  ) {
    errors.push({ code: "password.special_character_required" });
  }

  if (
    policy.checkUserContext &&
    containsContext(input.password, input.context)
  ) {
    errors.push({ code: "password.contextual" });
  }
  return errors;
}
function containsContext(
  password: string,
  context: PasswordContext | undefined,
): boolean {
  if (!context) {
    return false;
  }

  const normalizedPassword = password.toLocaleLowerCase();
  const candidates = [
    context.email?.split("@")[0],
    context.username,
    context.displayName,
    context.applicationName,
    context.organizationName,
  ];

  return candidates.some((candidate) => {
    const normalized = candidate?.trim().toLocaleLowerCase();
    return (
      Boolean(normalized && normalized.length >= 4) &&
      normalizedPassword.includes(normalized as string)
    );
  });
}
