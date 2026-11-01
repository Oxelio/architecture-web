import { describe, expect, it } from "vitest";

import { pseudonymizeAuditMetadata } from "./audit-pseudonymization.policy.js";

describe("Audit deletion minimization", () => {
  it("removes only the deleted party from nested values and keys without mutating evidence", () => {
    const input = {
      actor: "deleted-account",
      subject: "other-account",
      role: "admin",
      items: [
        { reason: "changed by deleted-account", "deleted-account": true },
        null,
        42,
      ],
    };
    const result = pseudonymizeAuditMetadata(
      input,
      new Map([["deleted-account", "irreversible-reference"]]),
    );
    expect(result).toEqual({
      actor: "irreversible-reference",
      subject: "other-account",
      role: "admin",
      items: [
        {
          reason: "changed by irreversible-reference",
          "irreversible-reference": true,
        },
        null,
        42,
      ],
    });
    expect(input.actor).toBe("deleted-account");
  });
  it("is idempotent and preserves unrelated evidence", () => {
    const replacements = new Map([["deleted-account", "reference"]]);
    const once = pseudonymizeAuditMetadata(
      { subject: "other", actor: "deleted-account" },
      replacements,
    );
    expect(pseudonymizeAuditMetadata(once, replacements)).toEqual(once);
  });
});
