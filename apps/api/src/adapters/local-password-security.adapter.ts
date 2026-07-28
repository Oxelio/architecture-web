import {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  type PasswordContext,
  PasswordStrengthEvaluator,
} from "@architecture/identity/application";
import type { PasswordStrength } from "@architecture/identity/domain";

const commonPasswords = new Set([
  "123456789012345",
  "azertyuiop12345",
  "passwordpassword",
  "qwertyuiop12345",
  "motdepasse12345",
]);

// Small embedded fallback. Deployments can replace this port with an updated
// local dataset or a privacy-preserving remote service.
const compromisedPasswords = new Set([
  "correct horse battery staple",
  "trustno1trustno1",
  "letmeinletmein123",
]);

export class LocalCommonPasswordChecker extends CommonPasswordChecker {
  async isCommon(password: string): Promise<boolean> {
    return commonPasswords.has(password.toLocaleLowerCase());
  }
}

export class LocalCompromisedPasswordChecker extends CompromisedPasswordChecker {
  async isCompromised(password: string): Promise<boolean> {
    return compromisedPasswords.has(password.toLocaleLowerCase());
  }
}

export class HeuristicPasswordStrengthEvaluator extends PasswordStrengthEvaluator {
  async evaluate(
    password: string,
    _context?: PasswordContext,
  ): Promise<PasswordStrength> {
    const length = [...password].length;
    let score = length >= 15 ? 2 : length >= 10 ? 1 : 0;

    if (length >= 20) {
      score += 1;
    }
    if (length >= 28) {
      score += 1;
    }

    const categories = [
      /\p{Ll}/u.test(password),
      /\p{Lu}/u.test(password),
      /\p{N}/u.test(password),
      /[^\p{L}\p{N}]/u.test(password),
    ].filter(Boolean).length;
    if (categories >= 3 && length >= 15) {
      score += 1;
    }

    if (
      /(.)\1{4,}/u.test(password) ||
      /(012345|123456|234567|345678|456789|abcdef|azerty|qwerty)/iu.test(
        password,
      )
    ) {
      score -= 1;
    }

    const strengths: PasswordStrength[] = [
      "too_weak",
      "weak",
      "acceptable",
      "strong",
      "very_strong",
    ];
    return strengths[Math.max(0, Math.min(4, score))] ?? "too_weak";
  }
}
