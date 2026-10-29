import { describe, expect, it, vi } from "vitest";

import { PublishedIamPolicies } from "#access-administration/security-configuration/published-iam-policies";
import { createPasswordPolicy } from "#domain/password-policy";
import { DEFAULT_SECURITY_POLICY } from "#domain/security-policy";

import { FixedPasswordPolicyReader } from "./password-policy.reader.js";
describe("password policy reader contract", () => {
  it("provides equivalent immutable policies from fixed and published configuration", async () => {
    const readPublished = vi.fn(async () => ({
      id: "revision",
      version: 7,
      values: structuredClone(DEFAULT_SECURITY_POLICY),
      createdBy: "actor",
      createdAt: new Date(),
      previousRevisionId: null,
    }));
    const dynamic = new PublishedIamPolicies({ readPublished });
    const fixed = new FixedPasswordPolicyReader({
      standard: createPasswordPolicy("elevated"),
      privileged: createPasswordPolicy("critical"),
    });
    for (const profile of ["standard", "privileged"] as const) {
      const value = await dynamic.get(profile);
      expect(value).toEqual(await fixed.get(profile));
      expect(Object.isFrozen(value)).toBe(true);
      expect(Object.isFrozen(value.composition)).toBe(true);
    }
    expect(readPublished).toHaveBeenCalledTimes(2);
  });
  it("keeps a previously selected snapshot stable when a new revision becomes effective", async () => {
    const values = structuredClone(DEFAULT_SECURITY_POLICY);
    const reader = new PublishedIamPolicies({
      readPublished: async () => ({
        id: "revision",
        version: 1,
        values,
        createdBy: "actor",
        createdAt: new Date(),
        previousRevisionId: null,
      }),
    });
    const first = await reader.get("standard");
    values.passwords.standardMinLength = 18;
    expect(first.minLength).toBe(15);
    expect((await reader.get("standard")).minLength).toBe(18);
  });
  it("rejects invalid fixed policies at construction", () => {
    expect(
      () =>
        new FixedPasswordPolicyReader({
          standard: { ...createPasswordPolicy(), minLength: NaN },
          privileged: createPasswordPolicy("critical"),
        }),
    ).toThrow();
  });
});
