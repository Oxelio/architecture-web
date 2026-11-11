import { describe, expect, it, vi } from "vitest";

import type { AuditRepository } from "#repositories/audit.repository";

import {
  createAuditEventConsumer,
  createAuditRetention,
} from "./audit-capabilities.js";

describe("Audit capability boundaries", () => {
  it("projects anonymous evidence and forwards only the cleanup reference", async () => {
    const append = vi
      .fn<AuditRepository["append"]>()
      .mockResolvedValue(undefined);
    const pseudonymizeSubject = vi
      .fn<AuditRepository["pseudonymizeSubject"]>()
      .mockResolvedValue(undefined);
    const reference = vi.fn<(id: string) => string>();
    const consumer = createAuditEventConsumer(
      { append, pseudonymizeSubject } as unknown as AuditRepository,
      { reference },
    );

    await consumer.record({
      type: "test.anonymous",
      result: "success",
      context: { actorType: "anonymous" },
      retentionDays: 1,
    });
    await consumer.removeAccountReferences("pseudonymous-account");

    expect(append).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        id: expect.any(String),
        actorReference: null,
        subjectReference: null,
        metadata: {},
      }),
    );
    expect(reference).not.toHaveBeenCalled();
    expect(pseudonymizeSubject).toHaveBeenCalledExactlyOnceWith(
      "pseudonymous-account",
    );
  });

  it("forwards the retention cutoff and returns the purge count", async () => {
    const cutoff = new Date("2026-01-02T00:00:00.000Z");
    const purgeExpired = vi
      .fn<AuditRepository["purgeExpired"]>()
      .mockResolvedValue(3);
    const retention = createAuditRetention({
      purgeExpired,
    } as unknown as AuditRepository);

    await expect(retention.purge(cutoff)).resolves.toBe(3);
    await expect(retention.purge()).resolves.toBe(3);
    expect(purgeExpired).toHaveBeenNthCalledWith(1, cutoff);
    expect(purgeExpired).toHaveBeenNthCalledWith(2, expect.any(Date));
  });
});
