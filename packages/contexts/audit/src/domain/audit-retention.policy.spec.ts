import { describe, expect, it } from "vitest";

import {
  auditExpiresAt,
  MAX_AUDIT_RETENTION_DAYS,
} from "./audit-retention.policy.js";

describe("Audit retention horizon", () => {
  it("uses occurrence time so replay cannot renew expired evidence", () => {
    expect(auditExpiresAt(new Date("2026-01-01T00:00:00Z"), 365)).toEqual(
      new Date("2027-01-01T00:00:00Z"),
    );
  });
  it.each([0, -1, 1.5, Number.NaN, MAX_AUDIT_RETENTION_DAYS + 1])(
    "rejects invalid duration %s",
    (days) => {
      expect(() => auditExpiresAt(new Date(), days)).toThrow("retention");
    },
  );
  it("rejects an invalid occurrence date", () => {
    expect(() => auditExpiresAt(new Date("invalid"), 365)).toThrow("retention");
  });
});
