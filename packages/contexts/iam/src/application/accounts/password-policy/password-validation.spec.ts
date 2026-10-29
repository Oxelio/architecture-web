import { describe, expect, it, vi } from "vitest";

import { createPasswordPolicy } from "#domain/password-policy";

import {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  PasswordStrengthEvaluator,
} from "./password-checks.js";
import { PasswordValidation } from "./password-validation.js";

class FakeStrengthEvaluator extends PasswordStrengthEvaluator {
  constructor(private readonly strength = "acceptable" as const) {
    super();
  }

  async evaluate() {
    return this.strength;
  }
}

class FakeCommonChecker extends CommonPasswordChecker {
  constructor(private readonly matches = false) {
    super();
  }

  async isCommon() {
    return this.matches;
  }
}

class FakeCompromisedChecker extends CompromisedPasswordChecker {
  constructor(private readonly matches = false) {
    super();
  }

  async isCompromised() {
    return this.matches;
  }
}

function createValidator(overrides = {}, common = false, compromised = false) {
  const validation = new PasswordValidation(
    new FakeStrengthEvaluator(),
    new FakeCommonChecker(common),
    new FakeCompromisedChecker(compromised),
  );
  return {
    validate: (input: Parameters<PasswordValidation["validate"]>[1]) =>
      validation.validate(createPasswordPolicy("elevated", overrides), input),
  };
}

describe("PasswordValidation", () => {
  it("propagates unexpected checker failures", async () => {
    const failure = new Error("checker unavailable");
    const validation = new PasswordValidation(
      new FakeStrengthEvaluator(),
      new FakeCommonChecker(),
      { isCompromised: vi.fn().mockRejectedValue(failure) },
    );
    await expect(
      validation.validate(createPasswordPolicy(), {
        password: "a sufficiently long phrase",
      }),
    ).rejects.toBe(failure);
  });
  it("accepts a long Unicode passphrase with spaces without modifying it", async () => {
    const password = "clé 🔐 gardée avec une longue phrase";
    const result = await createValidator({
      checkUserContext: false,
    }).validate({
      password,
      confirmation: password,
    });

    expect(result).toEqual({
      valid: true,
      strength: "acceptable",
      errors: [],
    });
  });

  it("counts Unicode code points instead of UTF-16 code units", async () => {
    const result = await createValidator({
      minLength: 15,
      maxLength: 64,
      checkUserContext: false,
    }).validate({
      password: "🔐".repeat(14),
      confirmation: "🔐".repeat(14),
    });

    expect(result.errors[0]).toEqual({
      code: "password.too_short",
      actual: 14,
      min: 15,
    });
  });

  it("rejects a mismatched confirmation", async () => {
    const result = await createValidator({
      checkUserContext: false,
    }).validate({
      password: "a sufficiently long phrase",
      confirmation: "a different long phrase",
    });

    expect(result.errors).toContainEqual({
      code: "password.confirmation_mismatch",
    });
  });

  it("reports common and compromised passwords through stable codes", async () => {
    const result = await createValidator(
      { checkUserContext: false },
      true,
      true,
    ).validate({
      password: "a sufficiently long phrase",
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        { code: "password.too_common" },
        { code: "password.compromised" },
      ]),
    );
  });

  it("rejects reliable account context without collecting more data", async () => {
    const result = await createValidator().validate({
      password: "long phrase for stephen",
      context: { email: "stephen@example.test" },
    });

    expect(result.errors).toContainEqual({ code: "password.contextual" });
  });

  it("supports opt-in legacy composition rules", async () => {
    const result = await createValidator({
      checkUserContext: false,
      composition: {
        requireUppercase: true,
        requireNumber: true,
      },
    }).validate({
      password: "a sufficiently long phrase",
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        { code: "password.uppercase_required" },
        { code: "password.number_required" },
      ]),
    );
  });

  it("provides secure standard, elevated, critical, and custom presets", () => {
    expect(createPasswordPolicy("standard").minLength).toBe(12);
    expect(createPasswordPolicy("elevated").minLength).toBe(15);
    expect(createPasswordPolicy("critical").minLength).toBe(20);
    expect(createPasswordPolicy("custom", { minLength: 24 }).minLength).toBe(
      24,
    );
    expect(createPasswordPolicy("elevated").maxLength).toBeGreaterThanOrEqual(
      64,
    );
  });
});
