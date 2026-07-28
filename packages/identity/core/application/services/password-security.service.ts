import type { PasswordPolicy, PasswordStrength } from "#domain/password-policy";

export interface PasswordContext {
  readonly email?: string;
  readonly username?: string;
  readonly displayName?: string;
  readonly applicationName?: string;
  readonly organizationName?: string;
}

export abstract class PasswordStrengthEvaluator {
  abstract evaluate(
    password: string,
    context?: PasswordContext,
  ): Promise<PasswordStrength>;
}

export abstract class CommonPasswordChecker {
  abstract isCommon(password: string): Promise<boolean>;
}

export abstract class CompromisedPasswordChecker {
  abstract isCompromised(password: string): Promise<boolean>;
}

export interface PasswordPolicyProvider {
  readonly policy: PasswordPolicy;
}
