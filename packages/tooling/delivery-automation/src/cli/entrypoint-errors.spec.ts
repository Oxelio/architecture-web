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
  ["dispatch authorization", () => import("./coordinator-dispatch.js")],
  ["coordinator dry run", () => import("./coordinator-dry-run.js")],
  ["gate publication", () => import("./gate-check-publish.js")],
  ["inventory", () => import("./inventory.js")],
  ["target verification", () => import("./target-verify.js")],
  ["task claim", () => import("./task-claim.js")],
  ["merge evaluation", () => import("./work-merge-gate-evaluate.js")],
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

  it("rejects an invalid gate pass value before publishing", async () => {
    vi.resetModules();
    vi.stubEnv("GITHUB_REPOSITORY", "example/fixture");
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv(
      "GATE_RESULT_B64",
      Buffer.from(
        JSON.stringify({
          gate: "work-merge",
          check: {
            name: "Architecture Web / Work Merge Gate",
            headSha: "a".repeat(40),
            title: "Check",
            summary: "Evidence",
            pass: "true",
          },
        }),
      ).toString("base64"),
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await import("./gate-check-publish.js");
    expect(process.exitCode).toBe(1);
    expect(String(stderr.mock.calls[0]?.[0])).toContain("invalid pass result");
    expect(fetch).not.toHaveBeenCalled();
  });
});
