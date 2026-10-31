import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  db: { destroy: vi.fn() },
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

import { buildApplicationModule } from "./application.module.js";

beforeEach(() => {
  vi.resetAllMocks();
  state.createRedis.mockReturnValue(state.redis);
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
  it("waits for both active workers before closing their connections", async () => {
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
  it("attempts both resource cleanups and preserves cleanup errors", async () => {
    const failure = new Error("Redis quit failed");
    state.redis.quit.mockRejectedValue(failure);
    const app = await buildApplicationModule();
    await expect(app.dispose()).rejects.toBeInstanceOf(AggregateError);
    expect(state.db.destroy).toHaveBeenCalledOnce();
  });
});
