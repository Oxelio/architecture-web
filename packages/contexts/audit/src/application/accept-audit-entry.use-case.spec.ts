import { describe, expect, it, vi } from "vitest";

import {
  AcceptAuditEntryUseCase,
  AuditAcceptanceEventHandler,
} from "./accept-audit-entry.use-case.js";

const input = {
  id: "event",
  type: "authentication.signin",
  result: "success" as const,
  retentionDays: 365,
  context: {
    actorType: "user" as const,
    actorId: "owner",
    subjectId: "owner",
    ipAddress: "test-network",
  },
  metadata: { password: "canary", safe: "visible" },
};
describe("Durable Audit acceptance", () => {
  it("publishes a stable minimized envelope and consumes it without re-enqueuing", async () => {
    const append = vi.fn(),
      record = vi.fn();
    const acceptance = new AcceptAuditEntryUseCase(
      { append },
      { reference: (value) => `hash-${value}` },
    );
    await acceptance.record(input);
    const event = append.mock.calls[0]?.[0]?.[0];
    expect(event.eventId).toBe("event");
    expect(JSON.stringify(event)).not.toContain("canary");
    expect(event.context).not.toHaveProperty("ipAddress");
    expect(event.context.networkFingerprint).toBe("hash-test-network");
    await new AuditAcceptanceEventHandler({ record }).handle(event);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event",
        type: input.type,
        metadata: { password: "[REDACTED]", safe: "visible" },
      }),
    );
    expect(append).toHaveBeenCalledOnce();
  });
  it("reports a lost event without failing the already successful business operation", async () => {
    const append = vi
        .fn()
        .mockRejectedValue(new Error("private provider details")),
      error = vi.fn();
    await expect(
      new AcceptAuditEntryUseCase(
        { append },
        { reference: (value) => value },
        { error },
      ).record(input),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      { eventId: "event" },
      "Audit durable acceptance failed; event lost",
    );
    expect(JSON.stringify(error.mock.calls)).not.toMatch(
      /private|canary|owner/,
    );
  });
  it("rejects unsupported or malformed envelopes before persistence", async () => {
    const append = vi.fn(),
      record = vi.fn();
    await new AcceptAuditEntryUseCase(
      { append },
      { reference: (value) => value },
    ).record(input);
    const event = append.mock.calls[0]?.[0]?.[0];
    const handler = new AuditAcceptanceEventHandler({ record });
    await expect(handler.handle({ ...event, version: 999 })).rejects.toThrow(
      "contract",
    );
    await expect(
      handler.handle({
        ...event,
        payload: { ...event.payload, retentionDays: -1 },
      }),
    ).rejects.toThrow("contract");
    expect(record).not.toHaveBeenCalled();
  });
});
