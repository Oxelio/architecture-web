import { describe, expect, it, vi } from "vitest";

import { OutboxMessageEntity } from "#domain/entities/outbox-message.entity";

import { OutboxWorker } from "./outbox-worker.js";

function claim(attempts = 1) {
  const now = new Date();
  return {
    claimToken: "claim",
    message: OutboxMessageEntity.rehydrate({
      event: {
        eventId: "event",
        topic: "test",
        version: 1,
        aggregateId: "account",
        occurredAt: now,
        payload: {},
        context: {},
      },
      status: "processing",
      attempts,
      availableAt: now,
      claimedAt: now,
      publishedAt: null,
      lastError: null,
    }),
  };
}
describe("OutboxWorker", () => {
  it("claims the next item only after dispatch and finalization of the current item", async () => {
    let finish!: () => void;
    const repository = {
      recoverStale: vi.fn(),
      claim: vi.fn().mockResolvedValueOnce(claim()).mockResolvedValue(null),
      finalize: vi.fn().mockResolvedValue(true),
    };
    const dispatch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const draining = new OutboxWorker(repository, { dispatch }).drain();
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledOnce());
    expect(repository.claim).toHaveBeenCalledOnce();
    expect(repository.finalize).not.toHaveBeenCalled();
    finish();
    expect(await draining).toBe(1);
    expect(repository.claim).toHaveBeenCalledTimes(2);
    expect(repository.finalize.mock.calls[0]?.[0].message.status).toBe(
      "published",
    );
  });
  it("dead-letters a tenth failed attempt and reports ownership loss without overwriting", async () => {
    const current = claim(10),
      logger = { error: vi.fn() };
    const repository = {
      recoverStale: vi.fn(),
      claim: vi.fn().mockResolvedValueOnce(current).mockResolvedValue(null),
      finalize: vi.fn().mockResolvedValue(false),
    };
    await new OutboxWorker(
      repository,
      {
        dispatch: async () => {
          throw new Error("unavailable");
        },
      },
      logger,
    ).drain();
    expect(current.message.status).toBe("dead_letter");
    expect(current.message.attempts).toBe(10);
    expect(logger.error).toHaveBeenCalledWith(
      { eventId: "event" },
      "Outbox claim expired or replaced",
    );
  });
});
