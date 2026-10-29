import type { PasswordValidation } from "#accounts/password-policy/password-validation";

import type {
  EvaluatePassword,
  EvaluatePasswordInput,
  GetPasswordPolicy,
  PasswordEvaluation,
  PublicPasswordPolicy,
} from "./password-policy.contracts.js";
import type { PasswordPolicyReader } from "./password-policy.reader.js";

export class GetPasswordPolicyUseCase implements GetPasswordPolicy {
  constructor(private readonly policies: PasswordPolicyReader) {}

  async execute(): Promise<PublicPasswordPolicy> {
    const policy = await this.policies.get("standard");
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
  constructor(
    private readonly policies: PasswordPolicyReader,
    private readonly validator: PasswordValidation,
  ) {}

  async execute(input: EvaluatePasswordInput): Promise<PasswordEvaluation> {
    const result = await this.validator.validate(
      await this.policies.get("standard"),
      {
        password: input.password,
      },
    );

    return {
      valid: result.valid,
      strength: result.strength,
      errorCodes: result.errors.map((error) => error.code),
    };
  }
}
