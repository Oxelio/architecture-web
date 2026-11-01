import { afterEach, expect, it, vi } from "vitest";

const { migrations, destroy, schema, run, setProvider } = vi.hoisted(() => {
  let provider: { getMigrations(): Promise<unknown> };
  const migrations = vi.fn(() => ({}));
  const destroy = vi.fn(() => Promise.resolve());
  const builder = {
    ifExists: () => builder,
    cascade: () => builder,
    execute: () => Promise.resolve(),
  };
  const schema = {
    dropSchema: vi.fn(() => builder),
    createSchema: vi.fn(() => builder),
  };
  const run = vi.fn(async () => {
    try {
      const result = provider.getMigrations();
      expect(result).toBeInstanceOf(Promise);
      await result;
      return { results: [{ status: "Success", migrationName: "fixture" }] };
    } catch (error) {
      return { error };
    }
  });
  return {
    migrations,
    destroy,
    schema,
    run,
    setProvider: (value: typeof provider) => {
      provider = value;
    },
  };
});
vi.mock("#composition-root/database.module", () => ({
  createDatabase: () => ({ schema, destroy }),
}));
vi.mock("#config/app.config", () => ({ loadConfig: () => ({ database: {} }) }));
vi.mock("./migrations.provider.js", () => ({ getAllMigrations: migrations }));
vi.mock("kysely/migration", () => ({
  Migrator: class {
    constructor(input: { provider: { getMigrations(): Promise<unknown> } }) {
      setProvider(input.provider);
    }
    migrateToLatest() {
      return run();
    }
    migrateDown() {
      return run();
    }
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
const entrypoints = [
  ["up", () => import("./migrate-up.js")],
  ["down", () => import("./migrate-down.js")],
  ["reset", () => import("./migrate-reset.js")],
] as const;

it.each(entrypoints)(
  "%s awaits its provider and destroys its database",
  async (name, load) => {
    vi.resetModules();
    migrations.mockReturnValue({});
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await load();
    expect(migrations).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect(schema.dropSchema).toHaveBeenCalledTimes(name === "reset" ? 1 : 0);
  },
);

it.each(entrypoints)(
  "%s keeps synchronous provider failures rejected and cleans up before exit",
  async (_, load) => {
    vi.resetModules();
    const failure = new Error("Unavailable migration inventory");
    const exit = new Error("Expected process exit");
    migrations.mockImplementationOnce(() => {
      throw failure;
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const stderr = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw exit;
    });
    await expect(load()).rejects.toBe(exit);
    expect(stderr).toHaveBeenCalledWith(failure);
    expect(destroy).toHaveBeenCalledOnce();
  },
);
