import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { createAuthoringIntakeNodeServer } from "../intake/authoring-intake.js";

type IntakeOptions = Parameters<typeof createAuthoringIntakeNodeServer>[0];
const mock = vi.hoisted(() => ({
  expire: vi.fn(),
  store: vi.fn(),
  server: vi.fn<(input: IntakeOptions) => void>(),
  listen: vi.fn(),
  on: vi.fn(),
  readFile: vi.fn(),
  dispatcher: vi.fn(),
  projectionDispatcher: vi.fn(),
  refresh: vi.fn(),
  output: vi.fn(),
}));

vi.mock(import("node:fs/promises"), async (original) => ({
  ...(await original()),
  readFile: mock.readFile,
}));
vi.mock(import("./gate-publication-support.js"), async (original) => ({
  ...(await original()),
  writeJson: mock.output,
}));
vi.mock("../intake/sealed-authoring-store.js", () => ({
  SealedAuthoringStore: class {
    expirePayloads = mock.expire;

    constructor(configuration: unknown) {
      mock.store(configuration);
    }
  },
}));
vi.mock(import("../intake/authoring-dispatch.js"), () => ({
  createAuthoringDispatcher: mock.dispatcher,
  createProjectProjectionDispatcher: mock.projectionDispatcher,
}));
vi.mock("../intake/authoring-intake.js", () => ({
  createAuthoringIntakeNodeServer: (input: IntakeOptions) => {
    mock.server(input);
    return { server: { on: mock.on, listen: mock.listen } };
  },
}));

const intakeOrigin = "https://intake.example.test";
const caller = {
  subject: "agent",
  tokenDigest: "a".repeat(64),
  workNumbers: [140],
};
let previousExitCode: typeof process.exitCode;

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  previousExitCode = process.exitCode;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const [key, value] of Object.entries({
    DELIVERY_AUTHORING_INTAKE_ENABLED: "true",
    DELIVERY_AUTHORING_INTAKE_ORIGIN: intakeOrigin,
    DELIVERY_AUTHORING_CALLERS: JSON.stringify([caller]),
    DELIVERY_AUTHORING_DISPATCH_CREDENTIAL_FILE: "/fixture/dispatch",
    DELIVERY_AUTHORING_PROJECTION_AGE_MS: "2000",
    DELIVERY_AUTHORING_CONTROL_REVISION: "b".repeat(40),
    DELIVERY_AUTHORING_PAYLOAD_LIFETIME_MS: "90000",
    DELIVERY_AUTHORING_STAGING_DIRECTORY: "/fixture/staging",
    DELIVERY_AUTHORING_MAXIMUM_PAYLOAD_BYTES: "1000",
    DELIVERY_AUTHORING_MAXIMUM_EXCHANGE_BYTES: "2000",
    DELIVERY_AUTHORING_DISPATCH_ACTOR_ID: "42",
    DELIVERY_AUTHORING_INTAKE_PORT: "9090",
  })) {
    vi.stubEnv(key, value);
  }
  mock.expire.mockResolvedValue(undefined);
  mock.projectionDispatcher.mockReturnValue(mock.refresh);
  mock.refresh.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  process.exitCode = previousExitCode;
});

it("binds locally and enforces per-subject Work visibility", async () => {
  await import("./authoring-intake-server.js");
  expect(mock.listen).toHaveBeenCalledWith(9090, "127.0.0.1");
  expect(mock.expire.mock.invocationCallOrder[0]).toBeLessThan(
    mock.listen.mock.invocationCallOrder[0] ?? 0,
  );
  const options = mock.server.mock.calls[0]?.[0];
  if (!options) {
    throw new Error("Missing server configuration");
  }
  await expect(options.readProjectContext?.("agent")).resolves.toEqual({
    status: "pending",
  });
  expect(mock.refresh).toHaveBeenCalledOnce();
  const work = {
    workNumber: 140,
    issueOpen: true,
    status: "Implementing",
    workType: null,
    workflowDepth: null,
  };
  const generatedAt = Date.now();
  expect(
    options.acceptProjectContext?.({
      generatedAt,
      works: [work, { ...work, workNumber: 146 }],
    }),
  ).toBe(true);
  await expect(options.readProjectContext?.("agent")).resolves.toEqual({
    projectNumber: 3,
    generatedAt,
    works: [work],
  });
  await expect(options.readProjectContext?.("other")).resolves.toEqual({
    projectNumber: 3,
    generatedAt,
    works: [],
  });
  mock.expire.mockRejectedValueOnce(new Error("private filename"));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(console.error).toHaveBeenCalledWith("AUTHORING_STAGE_CLEANUP_FAILED");
});

it("reads the rotated dispatch credential lazily and rejects malformed records", async () => {
  await import("./authoring-intake-server.js");
  expect(mock.readFile).not.toHaveBeenCalled();
  const [configuration] = mock.dispatcher.mock.calls[0] as [
    { readToken: () => Promise<unknown> },
  ];
  mock.readFile
    .mockResolvedValueOnce('{"token":"fixture-dispatch","expiresAt":1000}')
    .mockResolvedValueOnce('{"token":""}');
  await expect(configuration.readToken()).resolves.toEqual({
    token: "fixture-dispatch",
    expiresAt: 1000,
  });
  await expect(configuration.readToken()).resolves.toBeNull();
});

it.each(["inactive", "ambiguous"])(
  "does not listen when the intake is %s",
  async (state) => {
    if (state === "inactive") {
      vi.stubEnv("DELIVERY_AUTHORING_INTAKE_ENABLED", "");
    } else {
      vi.stubEnv(
        "DELIVERY_AUTHORING_CALLERS",
        JSON.stringify([caller, caller]),
      );
    }
    await import("./authoring-intake-server.js");
    expect(mock.output).toHaveBeenCalledWith({
      status: state === "inactive" ? "inactive" : "denied",
    });
    expect(mock.listen).not.toHaveBeenCalled();
  },
);
