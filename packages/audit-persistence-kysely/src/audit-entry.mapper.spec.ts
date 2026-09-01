import { describe, expect, it } from "vitest";

import { toAuditEntry } from "./audit-entry.mapper.js";
import type { AuditEventTable } from "./schema.js";

describe("toAuditEntry", () => {
  it("maps persistence data and redacts sensitive metadata", () => {
    const occurredAt = new Date("2026-01-01T00:00:00Z");
    const row: AuditEventTable = {
      id: "018f4d10-85d8-7c1c-9c04-f2724d9c6b61",
      type: "iam.user-password-changed",
      occurred_at: occurredAt,
      result: "success",
      actor_type: "user",
      actor_id: "user-1",
      subject_id: "user-1",
      correlation_id: "correlation-1",
      network_fingerprint: null,
      client: "test-client",
      metadata: JSON.stringify({ userId: "user-1", token: "secret" }),
      expires_at: new Date("2027-01-01T00:00:00Z"),
      legal_hold: false,
    };

    expect(toAuditEntry(row)).toEqual({
      id: row.id,
      type: row.type,
      occurredAt,
      result: "success",
      actorType: "user",
      actorId: "user-1",
      subjectId: "user-1",
      correlationId: "correlation-1",
      client: "test-client",
      metadata: { userId: "user-1", token: "[REDACTED]" },
    });
  });
});
