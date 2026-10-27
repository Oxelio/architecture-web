import type {
  PasswordContext,
  PasswordPolicy,
  PasswordPolicyViolation,
  PasswordStrength,
} from "#domain/password-policy";
import {
  comparePasswordStrength,
  evaluatePasswordRules,
} from "#domain/password-policy";

import type {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  PasswordStrengthEvaluator,
} from "./password-checks.js";
export type PasswordValidationError =
  PasswordPolicyViolation | { readonly code: "password.confirmation_mismatch" };
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
/** Coordinates pure policy evaluation and replaceable technical checks. Never reads configuration. */
export class PasswordValidation {
  constructor(
    private readonly strengthEvaluator: PasswordStrengthEvaluator,
    private readonly commonPasswordChecker: CommonPasswordChecker,
    private readonly compromisedPasswordChecker: CompromisedPasswordChecker,
  ) {}
  async validate(
    policy: PasswordPolicy,
    input: ValidatePasswordInput,
  ): Promise<PasswordValidationResult> {
    const errors: PasswordValidationError[] = [];
    if (
      input.confirmation !== undefined &&
      input.password !== input.confirmation
    ) {
      errors.push({ code: "password.confirmation_mismatch" });
    }
    errors.push(...evaluatePasswordRules(policy, input));
    const [strength, common, compromised] = await Promise.all([
      this.strengthEvaluator.evaluate(input.password, input.context),
      policy.checkCommonPasswords
        ? this.commonPasswordChecker.isCommon(input.password)
        : false,
      policy.checkCompromisedPasswords
        ? this.compromisedPasswordChecker.isCompromised(input.password)
        : false,
    ]);
    if (common) {
      errors.push({ code: "password.too_common" });
    }
    if (compromised) {
      errors.push({ code: "password.compromised" });
    }
    if (comparePasswordStrength(strength, policy.minimumStrength) < 0) {
      errors.push({ code: "password.too_weak" });
    }
    return { valid: errors.length === 0, strength, errors };
  }
}
