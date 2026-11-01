import { describe, expect, it, vi } from "vitest";

import type { AuditRepository } from "#repositories/audit.repository";

import { createAuditQueries } from "./create-audit-queries.js";

function fixture(
  overrides: Partial<{
    active: boolean;
    administrator: boolean;
    consultationEnabled: boolean;
  }> = {},
) {
  const entry = {
    id: "event",
    type: "account.role.changed",
    occurredAt: new Date(),
    result: "success",
    actorType: "administrator",
    actorId: "private-admin",
    subjectId: "owner",
    correlationId: "internal",
    client: "private-client",
    metadata: { internal: "private", password: "canary" },
  };
  const listForSubject = vi.fn().mockResolvedValue([entry]),
    query = vi.fn().mockResolvedValue([entry]),
    record = vi.fn();
  const application = createAuditQueries({
    repository: { listForSubject, query } as unknown as AuditRepository,
    recorder: { record },
    access: {
      resolveActor: async () => ({
        active: true,
        administrator: false,
        consultationEnabled: true,
        retentionDays: 365,
        ...overrides,
      }),
    },
  });
  return { application, entry, listForSubject, query, record };
}

describe("Audit query authorization and disclosure", () => {
  it("returns the minimal own projection, binds the owner and records consultation", async () => {
    const f = fixture();
    const result = await f.application.listOwn.execute({
      actorUserId: "owner",
    });
    expect(result).toEqual({
      success: true,
      value: [
        {
          id: f.entry.id,
          type: f.entry.type,
          occurredAt: f.entry.occurredAt,
          result: "success",
          actorType: "administrator",
        },
      ],
    });
    expect(f.listForSubject).toHaveBeenCalledWith("owner", 1, 25);
    expect(JSON.stringify(result)).not.toMatch(/private|internal|canary/);
    expect(f.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "security.audit.consulted",
        context: { actorType: "user", actorId: "owner", subjectId: "owner" },
        metadata: { scope: "own" },
      }),
    );
  });
  it.each([{ active: false }, { consultationEnabled: false }])(
    "refuses a disallowed personal query %j",
    async (state) => {
      const f = fixture(state);
      expect(
        (await f.application.listOwn.execute({ actorUserId: "owner" })).success,
      ).toBe(false);
      expect(f.listForSubject).not.toHaveBeenCalled();
    },
  );
  it("rejects a non-administrator independently from HTTP guards", async () => {
    const f = fixture();
    expect(
      await f.application.listAdministrative.execute({
        actorUserId: "owner",
        filters: { page: 1, pageSize: 25 },
      }),
    ).toEqual({
      success: false,
      error: { code: "audit_consultation.unauthorized" },
    });
    expect(f.query).not.toHaveBeenCalled();
  });
  it("redacts administrative output and audits the authorized query", async () => {
    const f = fixture({ administrator: true });
    const result = await f.application.listAdministrative.execute({
      actorUserId: "admin",
      filters: { page: 1, pageSize: 25 },
    });
    expect(result.success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("canary");
    expect(f.record).toHaveBeenCalledOnce();
  });
  it.each([
    { page: 0, pageSize: 25 },
    { page: 1, pageSize: 101 },
  ])("validates pagination before storage %j", async (filters) => {
    const f = fixture({ administrator: true });
    expect(
      (
        await f.application.listAdministrative.execute({
          actorUserId: "admin",
          filters,
        })
      ).success,
    ).toBe(false);
    expect(f.query).not.toHaveBeenCalled();
  });
  it("propagates unexpected storage failures", async () => {
    const f = fixture();
    const error = new Error("database unavailable");
    f.listForSubject.mockRejectedValue(error);
    await expect(
      f.application.listOwn.execute({ actorUserId: "owner" }),
    ).rejects.toBe(error);
  });
});
