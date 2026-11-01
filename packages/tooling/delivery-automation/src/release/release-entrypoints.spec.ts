import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { git } from "./repository.js";

const { releaseIt } = vi.hoisted(() => ({
  releaseIt: vi
    .fn()
    .mockResolvedValue({ version: "0.1.0", changelog: "notes" }),
}));
vi.mock("release-it", () => ({ default: releaseIt }));

const directories: string[] = [];
const originalArgv = process.argv;
const originalExitCode = process.exitCode;

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.clearAllMocks();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function root() {
  const directory = mkdtempSync(join(tmpdir(), "release-entry-"));
  directories.push(directory);
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  vi.spyOn(process, "chdir").mockImplementation(() => {
    // Keep the test worker's real cwd; CLI filesystem paths are absolute.
  });
  vi.resetModules();
  return directory;
}

describe("release entrypoint contracts", () => {
  it("generates verified artifacts through the in-process CLI entrypoint", async () => {
    const directory = root();
    git(directory, "init", "-b", "main");
    git(directory, "config", "user.name", "Release Test");
    git(directory, "config", "user.email", "release@example.invalid");
    git(
      directory,
      "remote",
      "add",
      "origin",
      "https://example.invalid/fixture.git",
    );
    writeFileSync(
      join(directory, "package.json"),
      '{"name":"fixture","version":"0.1.0"}',
    );
    writeFileSync(join(directory, "pnpm-workspace.yaml"), "packages: []\n");
    git(directory, "add", "package.json", "pnpm-workspace.yaml");
    git(directory, "commit", "-m", "feat: initial fixture");
    const sourceSha = git(directory, "rev-parse", "HEAD");
    writeFileSync(
      join(directory, "release-plan.json"),
      JSON.stringify({
        version: "0.1.0",
        tag: "v0.1.0",
        sourceSha,
        previousTag: null,
      }),
    );
    process.argv = [
      process.execPath,
      "release.ts",
      "generate",
      "output",
      "release-plan.json",
    ];
    await import("../cli/release.js");
    expect(process.exitCode).toBe(originalExitCode);
    expect(
      JSON.parse(
        readFileSync(join(directory, "output/release-manifest.json"), "utf8"),
      ),
    ).toMatchObject({ plan: { sourceSha, version: "0.1.0" } });
    expect(git(directory, "diff", "--name-only")).toBe("");
  }, 30_000);

  it("prints a read-only plan independently of an unrelated external artifact alias", async () => {
    const directory = root();
    git(directory, "init", "-b", "main");
    git(directory, "config", "user.name", "Release Test");
    git(directory, "config", "user.email", "release@example.invalid");
    writeFileSync(
      join(directory, "package.json"),
      '{"name":"fixture","version":"0.1.0"}',
    );
    git(directory, "add", "package.json");
    git(directory, "commit", "-m", "feat: initial fixture");
    symlinkSync(tmpdir(), join(directory, "release-output"), "junction");
    const before = git(directory, "status", "--porcelain");
    process.argv = [process.execPath, "release.ts"];
    const output = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await import("../cli/release.js");
    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
      version: "0.1.0",
      sourceSha: git(directory, "rev-parse", "HEAD"),
    });
    expect(git(directory, "status", "--porcelain")).toBe(before);
  });

  it("reports a rejected external path with failure status and no generated output", async () => {
    const directory = root();
    git(directory, "init", "-b", "main");
    process.argv = [
      process.execPath,
      "release.ts",
      "generate",
      "../external-output",
    ];
    const output = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await import("../cli/release.js");
    expect(process.exitCode).toBe(1);
    expect(String(output.mock.calls[0]?.[0])).toContain(
      "RELEASE_PATH_OUTSIDE_REPOSITORY",
    );
  });

  it("exchanges parsed configuration and serialized results at fixed runner paths", async () => {
    const directory = root();
    process.argv = [process.execPath, "release-it-runner.ts"];
    const config = { ci: true, increment: "0.1.0" };
    writeFileSync(
      join(directory, ".release-it-input.json"),
      JSON.stringify(config),
    );
    await import("./release-it-runner.js");
    expect(releaseIt).toHaveBeenCalledWith(config);
    expect(
      JSON.parse(
        readFileSync(join(directory, ".release-it-result.json"), "utf8"),
      ),
    ).toEqual({ version: "0.1.0", changelog: "notes" });
  });

  it("rejects extra runner arguments before invoking release-it", async () => {
    root();
    process.argv = [process.execPath, "release-it-runner.ts", "arbitrary.json"];
    await expect(import("./release-it-runner.js")).rejects.toThrow(
      "does not accept arguments",
    );
    expect(releaseIt).not.toHaveBeenCalled();
  });

  it("rejects a non-file configuration before invoking release-it", async () => {
    const directory = root();
    process.argv = [process.execPath, "release-it-runner.ts"];
    mkdirSync(join(directory, ".release-it-input.json"));
    await expect(import("./release-it-runner.js")).rejects.toThrow(
      "requires a regular configuration file",
    );
    expect(releaseIt).not.toHaveBeenCalled();
  });

  it("does not replace an existing runner result", async () => {
    const directory = root();
    process.argv = [process.execPath, "release-it-runner.ts"];
    writeFileSync(join(directory, ".release-it-input.json"), "{}");
    writeFileSync(join(directory, ".release-it-result.json"), "preserved");
    await expect(import("./release-it-runner.js")).rejects.toThrow();
    expect(
      readFileSync(join(directory, ".release-it-result.json"), "utf8"),
    ).toBe("preserved");
  });
});
