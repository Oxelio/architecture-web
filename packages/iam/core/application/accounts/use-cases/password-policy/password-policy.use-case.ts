import type { PasswordPolicyValidator } from "#services/password-policy-validator.service";

import type {
  EvaluatePassword,
  EvaluatePasswordInput,
  GetPasswordPolicy,
  PasswordEvaluation,
  PublicPasswordPolicy,
} from "./password-policy.contracts.js";

export class GetPasswordPolicyUseCase implements GetPasswordPolicy {
  constructor(private readonly validator: PasswordPolicyValidator) {}

  async execute(): Promise<PublicPasswordPolicy> {
    const policy = await this.validator.getPublicPolicy();
    return {
      level: policy.level,
      minLength: policy.minLength,
      maxLength: policy.maxLength,
      minimumStrength: policy.minimumStrength,
      checks: {
        commonPasswords: policy.checkCommonPasswords,
        compromisedPasswords: policy.checkCompromisedPasswords,
        userContext: policy.checkUserContext,
      },
      composition: policy.composition,
      lengthUnit: "unicode_code_points",
      normalization: "none",
    };
  }
}

export class EvaluatePasswordUseCase implements EvaluatePassword {
  constructor(private readonly validator: PasswordPolicyValidator) {}

  async execute(input: EvaluatePasswordInput): Promise<PasswordEvaluation> {
    const result = await this.validator.validate({
      password: input.password,
    });

    return {
      valid: result.valid,
      strength: result.strength,
      errorCodes: result.errors.map((error) => error.code),
    };
  }
}
