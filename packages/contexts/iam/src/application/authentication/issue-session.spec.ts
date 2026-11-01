import { describe, expect, it, vi } from "vitest";

import { UserEntity } from "#entities/user.entity";

import { IssueSession } from "./issue-session.js";

describe("Redis/PostgreSQL session issuance boundary", () => {
  it("does not append a fact when Redis save fails", async () => {
    const failure = new Error("Redis unavailable"),
      append = vi.fn();
    const sessions = {
      saveEnforcingMaximum: vi.fn().mockRejectedValue(failure),
    };
    const issue = new IssueSession(
      sessions as never,
      { getSessionPolicy: async () => ({ durationMinutes: 60 }) } as never,
      { append },
    );
    await expect(issue.issue(UserEntity.create())).rejects.toBe(failure);
    expect(append).not.toHaveBeenCalled();
  });
  it("preserves successful Redis issuance and reports lost facts when acceptance fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("PostgreSQL unavailable"),
      saveEnforcingMaximum = vi.fn().mockResolvedValue(undefined);
    const append = vi.fn().mockRejectedValue(failure);
    const issue = new IssueSession(
      { saveEnforcingMaximum } as never,
      { getSessionPolicy: async () => ({ durationMinutes: 60 }) } as never,
      { append },
    );
    await expect(issue.issue(UserEntity.create())).resolves.toHaveProperty(
      "sessionId",
    );
    expect(saveEnforcingMaximum).toHaveBeenCalledOnce();
    expect(append).toHaveBeenCalledOnce();
    const session = saveEnforcingMaximum.mock.calls[0]?.[0];
    expect(JSON.stringify(append.mock.calls)).not.toContain(
      session.identifier.value,
    );
    expect(log).toHaveBeenCalledWith(
      "Session fact acceptance failed; events lost",
      expect.any(Object),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      session.identifier.value,
    );
    log.mockRestore();
  });
});
