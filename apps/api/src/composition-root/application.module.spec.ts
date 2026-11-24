import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  db: { destroy: vi.fn(), $pickTables: vi.fn() },
  redis: { quit: vi.fn(), disconnect: vi.fn() },
  createRedis: vi.fn(),
  buildIam: vi.fn(),
  poll: vi.fn(),
}));
vi.mock("#config/app.config", () => ({
  loadConfig: () => ({
    database: {},
    redis: {},
    smtp: {
      host: "localhost",
      port: 1025,
      username: "",
      password: "",
      from: "test@example.test",
      verifyUrl: "http://localhost/verify",
    },
    notifications: {},
    security: {},
  }),
}));
vi.mock("./database.module.js", () => ({ createDatabase: () => state.db }));
vi.mock("./redis.module.js", () => ({ createRedis: state.createRedis }));
vi.mock("./iam.module.js", () => ({ buildIamModule: state.buildIam }));
vi.mock("./background-polling.js", () => ({
  startBackgroundPolling: state.poll,
}));

import { KyselyAuditRepositoryAdapter } from "@architecture/audit-persistence-kysely";

import { buildApplicationModule } from "./application.module.js";

beforeEach(() => {
  vi.resetAllMocks();
  state.createRedis.mockReturnValue(state.redis);
  state.db.$pickTables.mockReturnValue(state.db);
  state.buildIam.mockResolvedValue({
    iam: {},
    configuration: {},
    securityEvents: {},
  });
  state.poll.mockReturnValue(async () => undefined);
  state.db.destroy.mockResolvedValue(undefined);
  state.redis.quit.mockResolvedValue(undefined);
});

describe("application worker lifecycle", () => {
  it("schedules hourly retention and waits for it during shutdown", async () => {
    let finish!: () => void;
    const stopRetention = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    state.poll.mockImplementation((_work, _onError, intervalMs) =>
      intervalMs === 3_600_000 ? stopRetention : async () => undefined,
    );
    const purge = vi
      .spyOn(KyselyAuditRepositoryAdapter.prototype, "purgeExpired")
      .mockResolvedValue(0);
    try {
      const app = await buildApplicationModule();
      const retentionPolls = state.poll.mock.calls.filter(
        ([, , intervalMs]) => intervalMs === 3_600_000,
      );
      expect(retentionPolls).toHaveLength(1);
      await retentionPolls[0]?.[0]();
      expect(purge).toHaveBeenCalledOnce();
      const closing = app.dispose();
      expect(state.db.destroy).not.toHaveBeenCalled();
      finish();
      await closing;
      expect(stopRetention).toHaveBeenCalledOnce();
      expect(state.db.destroy).toHaveBeenCalledOnce();
    } finally {
      purge.mockRestore();
    }
  });
  it("closes PostgreSQL when Redis creation throws", async () => {
    const failure = new Error("Redis construction failed");
    state.createRedis.mockImplementation(() => {
      throw failure;
    });
    await expect(buildApplicationModule()).rejects.toBe(failure);
    expect(state.db.destroy).toHaveBeenCalledOnce();
    expect(state.poll).not.toHaveBeenCalled();
  });
  it("disconnects Redis and destroys PostgreSQL after initialization failure", async () => {
    const failure = new Error("IAM initialization failed");
    state.buildIam.mockRejectedValue(failure);
    await expect(buildApplicationModule()).rejects.toBe(failure);
    expect(state.redis.disconnect).toHaveBeenCalledOnce();
    expect(state.db.destroy).toHaveBeenCalledOnce();
    expect(state.poll).not.toHaveBeenCalled();
  });
  it("waits for the active outbox worker before closing connections", async () => {
    let complete!: () => void;
    const stop = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    state.poll.mockReturnValueOnce(stop);
    const app = await buildApplicationModule(),
      disposing = app.dispose();
    expect(stop).toHaveBeenCalledOnce();
    expect(state.db.destroy).not.toHaveBeenCalled();
    expect(state.redis.quit).not.toHaveBeenCalled();
    complete();
    await disposing;
    expect(state.db.destroy).toHaveBeenCalledOnce();
    expect(state.redis.quit).toHaveBeenCalledOnce();
  });
  it("schedules four notification workers with the expected batch size", async () => {
    const app = await buildApplicationModule();
    const execute = vi
      .spyOn(app.notifications.deliverPending, "execute")
      .mockResolvedValue({ success: true, value: 0 });
    try {
      expect(state.poll).toHaveBeenCalledTimes(6);
      const notificationPolls = state.poll.mock.calls.slice(1, 5);
      await Promise.all(notificationPolls.map(([work]) => work()));
      expect(execute).toHaveBeenCalledTimes(4);
      expect(execute).toHaveBeenCalledWith({ limit: 50 });
    } finally {
      execute.mockRestore();
      await app.dispose();
    }
  });

  it("waits for all notification workers even when one fails to stop", async () => {
    const failure = new Error("Notification worker shutdown failed");
    let complete!: () => void;
    const stops = [
      vi.fn().mockRejectedValue(failure),
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      ),
    ];
    state.poll.mockReturnValueOnce(async () => undefined);
    for (const stop of stops) {
      state.poll.mockReturnValueOnce(stop);
    }

    const app = await buildApplicationModule();
    const closing = expect(app.dispose()).rejects.toThrow(
      "Application resource cleanup failed",
    );
    try {
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      for (const stop of stops) {
        expect(stop).toHaveBeenCalledOnce();
      }
      expect(state.db.destroy).not.toHaveBeenCalled();
      expect(state.redis.quit).not.toHaveBeenCalled();
    } finally {
      complete();
      await closing;
    }
    expect(state.db.destroy).toHaveBeenCalledOnce();
    expect(state.redis.quit).toHaveBeenCalledOnce();
  });

  it("attempts both resource cleanups and preserves cleanup errors", async () => {
    const failure = new Error("Redis quit failed");
    state.redis.quit.mockRejectedValue(failure);
    const app = await buildApplicationModule();
    await expect(app.dispose()).rejects.toBeInstanceOf(AggregateError);
    expect(state.db.destroy).toHaveBeenCalledOnce();
  });
});
