import { afterEach, describe, expect, it, vi } from "vitest";

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const entrypoints = [
  ["activation verification", () => import("./activation-verify.js")],
  ["claim reconciliation", () => import("./claim-reconcile-plan.js")],
  ["coordinator dry run", () => import("./coordinator-dry-run.js")],
  ["inventory", () => import("./inventory.js")],
  ["target verification", () => import("./target-verify.js")],
  ["task claim", () => import("./task-claim.js")],
] as const;

describe("delivery CLI failure contracts", () => {
  it.each(entrypoints)(
    "%s reports invalid configuration before network effects",
    async (_, load) => {
      vi.resetModules();
      process.argv = [process.execPath, "entrypoint", "--unknown-option"];
      process.exitCode = undefined;
      vi.stubEnv("GITHUB_REPOSITORY", "");
      vi.stubEnv("GITHUB_TOKEN", "");
      vi.stubEnv("ARCHITECTURE_WEB_PROJECTS_TOKEN", "");
      const fetch = vi.fn(() => {
        throw new Error("Network must not be reached");
      });
      vi.stubGlobal("fetch", fetch);
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      await load();
      expect(process.exitCode).toBe(1);
      expect(stderr.mock.calls.length + consoleError.mock.calls.length).toBe(1);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "dispatch authorization",
      () => import("./coordinator-dispatch.js"),
      "ROUTE_OWNER_INACTIVE",
    ],
    [
      "dispatch observation",
      () => import("./coordinator-dry-run.js"),
      "TASK_DISPATCH_OBSERVATION_RETIRED",
    ],
    [
      "Task claim",
      () => import("./task-claim.js"),
      "TASK_CLAIM_OWNER_INACTIVE",
    ],
    [
      "claim reconciliation",
      () => import("./claim-reconcile-plan.js"),
      "TASK_CLAIM_OWNER_INACTIVE",
    ],
  ] as const)(
    "%s fails closed before any GitHub request",
    async (_, load, blocker) => {
      vi.resetModules();
      process.argv = [
        process.execPath,
        "entrypoint",
        "acquire",
        "--work",
        "202",
        "--task",
        "1",
      ];
      vi.stubEnv("GITHUB_REPOSITORY", "Oxelio/Architecture-Web");
      vi.stubEnv("GITHUB_TOKEN", "repo-fixture");
      vi.stubEnv("ARCHITECTURE_WEB_PROJECTS_TOKEN", "projects-fixture");
      vi.stubEnv("COORDINATOR_MODE", "task-dispatch");
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      await load();

      const output = JSON.parse(
        String((stdout.mock.calls[0] ?? log.mock.calls[0])?.[0]),
      );
      expect(process.exitCode).toBe(2);
      expect(output.status).toBe("blocked");
      expect(output.reason ?? output.blockers).toContain(blocker);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
