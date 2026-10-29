import type {
  PasswordContext,
  PasswordStrength,
} from "#domain/password-policy";
export type { PasswordContext } from "#domain/password-policy";
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
