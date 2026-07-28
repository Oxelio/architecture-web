import type { PasswordPolicy, PasswordStrength } from "#domain/password-policy";
import { comparePasswordStrength } from "#domain/password-policy";

import type {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  PasswordContext,
  PasswordStrengthEvaluator,
} from "./password-security.service.js";

export type PasswordValidationError =
  | { readonly code: "password.empty" }
  | { readonly code: "password.confirmation_mismatch" }
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

export interface PasswordValidationResult {
  readonly valid: boolean;
  readonly strength: PasswordStrength;
  readonly errors: readonly PasswordValidationError[];
}

export interface ValidatePasswordInput {
  readonly password: string;
  readonly confirmation?: string;
  readonly context?: PasswordContext;
}

export class PasswordPolicyValidator {
  constructor(
    private readonly policy: PasswordPolicy,
    private readonly strengthEvaluator: PasswordStrengthEvaluator,
    private readonly commonPasswordChecker: CommonPasswordChecker,
    private readonly compromisedPasswordChecker: CompromisedPasswordChecker,
  ) {}

  get publicPolicy(): PasswordPolicy {
    return this.policy;
  }

  async validate(
    input: ValidatePasswordInput,
  ): Promise<PasswordValidationResult> {
    const errors: PasswordValidationError[] = [];
    const length = [...input.password].length;

    if (
      input.confirmation !== undefined &&
      input.password !== input.confirmation
    ) {
      errors.push({ code: "password.confirmation_mismatch" });
    }
    if (length === 0) {
      errors.push({ code: "password.empty" });
    } else if (length < this.policy.minLength) {
      errors.push({
        code: "password.too_short",
        actual: length,
        min: this.policy.minLength,
      });
    }
    if (length > this.policy.maxLength) {
      errors.push({
        code: "password.too_long",
        actual: length,
        max: this.policy.maxLength,
      });
    }

    const { composition } = this.policy;
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

    const [strength, common, compromised] = await Promise.all([
      this.strengthEvaluator.evaluate(input.password, input.context),
      this.policy.checkCommonPasswords
        ? this.commonPasswordChecker.isCommon(input.password)
        : false,
      this.policy.checkCompromisedPasswords
        ? this.compromisedPasswordChecker.isCompromised(input.password)
        : false,
    ]);

    if (common) {
      errors.push({ code: "password.too_common" });
    }
    if (compromised) {
      errors.push({ code: "password.compromised" });
    }
    if (
      this.policy.checkUserContext &&
      containsContext(input.password, input.context)
    ) {
      errors.push({ code: "password.contextual" });
    }
    if (comparePasswordStrength(strength, this.policy.minimumStrength) < 0) {
      errors.push({ code: "password.too_weak" });
    }

    return {
      valid: errors.length === 0,
      strength,
      errors,
    };
  }
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
