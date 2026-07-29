import { describe, expect, it } from "vitest";

import { createIam } from "./create-iam.js";

describe("createIam", () => {
  it("wires every iam use case", () => {
    const iam = createIam({
      userRepository: {} as never,
      sessionRepository: {} as never,
      passwordHasher: {} as never,
      policyProvider: {} as never,
      passwordStrengthEvaluator: {} as never,
      commonPasswordChecker: {} as never,
      compromisedPasswordChecker: {} as never,
      emailSender: {} as never,
      emailVerificationRepository: {} as never,
      rateLimiter: {} as never,
      emailVerificationTokenHasher: {} as never,
    });

    expect(Object.keys(iam)).toEqual([
      "assignUserRole",
      "activateUser",
      "changeEmail",
      "changePassword",
      "getCurrentAccount",
      "getUserAdministrationOverview",
      "listUsers",
      "listCurrentUserSessions",
      "listUserSessions",
      "getPasswordPolicy",
      "evaluatePassword",
      "resendEmailVerification",
      "resolveSession",
      "revokeCurrentUserSession",
      "revokeUserSession",
      "signIn",
      "signOut",
      "signUp",
      "suspendUser",
      "verifyEmail",
    ]);
    expect(Object.values(iam).every((useCase) => "execute" in useCase)).toBe(
      true,
    );
  });
});
