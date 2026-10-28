import { describe, expect, it } from "vitest";

import {
  DEFAULT_SECURITY_POLICY,
  parseSecurityPolicy,
  parseStoredSecurityPolicy,
} from "./security-policy.js";
describe("stored security-policy representations", () => {
  it("preserves the legacy email-only default without modifying its source", () => {
    const { allowedLoginIdentifiers: _identifiers, ...accounts } =
      DEFAULT_SECURITY_POLICY.accounts;
    const legacy = {
      ...structuredClone(DEFAULT_SECURITY_POLICY),
      accounts,
      sessions: { userManagement: false, durationMinutes: 137 },
    };
    const decoded = parseStoredSecurityPolicy(legacy, 1);
    expect(
      decoded.success && decoded.value.accounts.allowedLoginIdentifiers,
    ).toEqual(["email"]);
    expect(decoded.success && decoded.value.sessions.durationMinutes).toBe(137);
    expect(Object.hasOwn(legacy.accounts, "allowedLoginIdentifiers")).toBe(
      false,
    );
    expect(parseSecurityPolicy(legacy).success).toBe(false);
  });
  it("decodes historical duplicate sets explicitly and keeps current validation strict", () => {
    const legacy = structuredClone(DEFAULT_SECURITY_POLICY);
    legacy.accounts.allowedLoginIdentifiers = ["email", "email"];
    legacy.authentication.mfaRequiredRoles = ["user", "user"];
    const result = parseStoredSecurityPolicy(legacy, 1);
    expect(
      result.success && result.value.authentication.mfaRequiredRoles,
    ).toEqual(["user"]);
    expect(parseStoredSecurityPolicy(legacy, 2).success).toBe(false);
    expect(legacy.accounts.allowedLoginIdentifiers).toHaveLength(2);
  });
  it("does not silently discard unknown values or accept unsupported versions", () => {
    expect(
      parseStoredSecurityPolicy(
        { ...DEFAULT_SECURITY_POLICY, unknown: true },
        1,
      ).success,
    ).toBe(false);
    expect(parseStoredSecurityPolicy(DEFAULT_SECURITY_POLICY, 3).success).toBe(
      false,
    );
    expect(parseStoredSecurityPolicy({ accounts: null }, 1).success).toBe(
      false,
    );
  });
});
