import type {
  PasswordCompositionRules,
  PasswordSecurityLevel,
  PasswordStrength,
} from "#domain/password-policy";

export interface PublicPasswordPolicy {
  readonly level: PasswordSecurityLevel;
  readonly minLength: number;
  readonly maxLength: number;
  readonly minimumStrength: PasswordStrength;
  readonly checks: {
    readonly commonPasswords: boolean;
    readonly compromisedPasswords: boolean;
    readonly userContext: boolean;
  };
  readonly composition: PasswordCompositionRules;
  readonly lengthUnit: "unicode_code_points";
  readonly normalization: "none";
}

export interface GetPasswordPolicy {
  execute(): PublicPasswordPolicy;
}

export interface EvaluatePasswordInput {
  readonly password: string;
}

export interface PasswordEvaluation {
  readonly valid: boolean;
  readonly strength: PasswordStrength;
  readonly errorCodes: readonly string[];
}

export interface EvaluatePassword {
  execute(input: EvaluatePasswordInput): Promise<PasswordEvaluation>;
}
