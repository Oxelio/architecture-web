import {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  type PasswordContext,
  PasswordStrengthEvaluator,
} from "@architecture/iam/application";
import type { PasswordStrength } from "@architecture/iam/domain";

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
  isCommon(password: string): Promise<boolean> {
    try {
      return Promise.resolve(commonPasswords.has(password.toLocaleLowerCase()));
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}

export class LocalCompromisedPasswordChecker extends CompromisedPasswordChecker {
  isCompromised(password: string): Promise<boolean> {
    try {
      return Promise.resolve(
        compromisedPasswords.has(password.toLocaleLowerCase()),
      );
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}

export class HeuristicPasswordStrengthEvaluator extends PasswordStrengthEvaluator {
  evaluate(
    password: string,
    _context?: PasswordContext,
  ): Promise<PasswordStrength> {
    try {
      const length = [...password].length;
      let score = length >= 10 ? 1 : 0;
      if (length >= 15) {
        score = 2;
      }

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
      return Promise.resolve(
        strengths[Math.max(0, Math.min(4, score))] ?? "too_weak",
      );
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
