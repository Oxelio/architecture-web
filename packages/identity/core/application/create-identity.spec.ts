import { describe, expect, it } from "vitest";

import { createIdentity } from "./create-identity.js";

describe("createIdentity", () => {
  it("wires every identity use case", () => {
    const identity = createIdentity({
      userRepository: {} as never,
      sessionRepository: {} as never,
      passwordHasher: {} as never,
      passwordPolicy: {} as never,
      privilegedPasswordPolicy: {} as never,
      passwordStrengthEvaluator: {} as never,
      commonPasswordChecker: {} as never,
      compromisedPasswordChecker: {} as never,
      emailSender: {} as never,
      emailVerificationRepository: {} as never,
      rateLimiter: {} as never,
      emailVerificationTokenHasher: {} as never,
    });

    expect(Object.keys(identity)).toEqual([
      "assignUserRole",
      "activateUser",
      "changeEmail",
      "changePassword",
      "getUserProfile",
      "listUsers",
      "listUserSessions",
      "getPasswordPolicy",
      "evaluatePassword",
      "resendEmailVerification",
      "resolveSession",
      "revokeUserSession",
      "signIn",
      "signOut",
      "signUp",
      "suspendUser",
      "verifyEmail",
    ]);
    expect(
      Object.values(identity).every((useCase) => "execute" in useCase),
    ).toBe(true);
  });
});
