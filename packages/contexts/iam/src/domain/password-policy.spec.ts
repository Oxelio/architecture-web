import { describe, expect, it } from "vitest";

import {
  createPasswordPolicy,
  evaluatePasswordRules,
  selectPasswordPolicyProfile,
} from "./password-policy.js";
describe("password policy", () => {
  it.each([NaN, Infinity, 15.5, 0])(
    "rejects invalid minimum %s",
    (minLength) => {
      expect(() => createPasswordPolicy("elevated", { minLength })).toThrow();
    },
  );
  it("validates runtime values and freezes nested composition", () => {
    expect(() =>
      createPasswordPolicy("elevated", {
        checkCommonPasswords: "true" as never,
      }),
    ).toThrow();
    expect(() =>
      createPasswordPolicy("elevated", { minimumStrength: "unknown" as never }),
    ).toThrow();
    expect(() =>
      createPasswordPolicy("elevated", { minLength: 100, maxLength: 64 }),
    ).toThrow();
    const policy = createPasswordPolicy();
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.composition)).toBe(true);
  });
  it("evaluates Unicode and contextual rules independently of providers", () => {
    const policy = createPasswordPolicy("elevated", { minLength: 15 });
    expect(
      evaluatePasswordRules(policy, { password: "🔐".repeat(14) }),
    ).toContainEqual({ code: "password.too_short", actual: 14, min: 15 });
    expect(
      evaluatePasswordRules(policy, {
        password: "a long password for stephen",
        context: { username: "stephen" },
      }),
    ).toContainEqual({ code: "password.contextual" });
    expect(selectPasswordPolicyProfile({ isAdmin: () => true })).toBe(
      "privileged",
    );
    expect(selectPasswordPolicyProfile({ isAdmin: () => false })).toBe(
      "standard",
    );
  });
});
