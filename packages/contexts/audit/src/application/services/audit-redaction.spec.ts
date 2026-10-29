import { describe, expect, it, vi } from "vitest";

import type { AuditRepository } from "#repositories/audit.repository";

import { AuditApplication } from "./audit.application.js";
describe("Audit disclosure boundaries", () => {
  it("redacts persisted credentials on both recording and disclosure", async () => {
    const entry = {
      id: "event",
      type: "session.started",
      occurredAt: new Date(),
      result: "success",
      actorType: "user",
      actorId: "actor",
      subjectId: "actor",
      correlationId: null,
      client: null,
      metadata: {
        sessionId: "bearer-canary",
        nested: { password: "password-canary", reason: "visible" },
      },
    };
    const append = vi.fn(),
      repository = {
        append,
        listForSubject: async () => [entry],
        query: async () => [entry],
        exportForSubject: async () => [entry],
      } as unknown as AuditRepository;
    const audit = new AuditApplication(repository);
    await audit.record({
      type: entry.type,
      result: "success",
      context: { actorType: "user" },
      metadata: entry.metadata,
      retentionDays: 365,
    });
    for (const output of [
      append.mock.calls,
      await audit.listOwn("actor", 1, 25),
      await audit.list({ page: 1, pageSize: 25 }),
      await audit.exportFor("actor"),
    ]) {
      expect(JSON.stringify(output)).not.toContain("bearer-canary");
      expect(JSON.stringify(output)).not.toContain("password-canary");
      expect(JSON.stringify(output)).toContain("visible");
    }
  });
});
