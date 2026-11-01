import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  confinedReleasePath,
  prepareReleaseOutput,
  verifiedReleaseInput,
} from "./release-paths.js";
import { git, readReleasePlan } from "./repository.js";

const require = createRequire(import.meta.url);
const cli = fileURLToPath(new URL("../cli/release.ts", import.meta.url));
const allocated: string[] = [];

afterEach(() => {
  for (const directory of allocated.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture() {
  const temporary = mkdtempSync(join(tmpdir(), "release-paths-"));
  allocated.push(temporary);
  const root = join(temporary, "source");
  const outside = join(temporary, "source-neighbor");
  mkdirSync(root);
  mkdirSync(outside);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Release Test");
  git(root, "config", "user.email", "release@example.invalid");
  git(
    root,
    "remote",
    "add",
    "origin",
    "https://example.invalid/release-fixture.git",
  );
  writeFileSync(
    join(root, "package.json"),
    '{"name":"fixture","version":"0.1.0"}',
  );
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
  git(root, "add", "package.json", "pnpm-workspace.yaml");
  git(root, "commit", "-m", "feat: initial fixture");
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(require.resolve("tsx/esm")).href,
        cli,
        ...args,
      ],
      { cwd: root, encoding: "utf8", timeout: 30_000 },
    );
  return { root, outside, run };
}

describe("release CLI repository confinement", () => {
  it("generates byte-identical archives with relative and absolute in-root output paths", async () => {
    const f = fixture();
    const plan = await readReleasePlan(
      f.root,
      git(f.root, "rev-parse", "HEAD"),
    );
    const planPath = join(f.root, "release-plan.json");
    writeFileSync(planPath, JSON.stringify(plan));
    const relative = f.run("generate", "..cache/nested", planPath);
    expect(relative.stderr, "relative generation").not.toContain("Error");
    expect(relative.status).toBe(0);
    const absolute = f.run("generate", join(f.root, "absolute"), planPath);
    expect(absolute.status).toBe(0);
    expect(
      readFileSync(join(f.root, "..cache/nested/SHA256SUMS"), "utf8"),
    ).toBe(readFileSync(join(f.root, "absolute/SHA256SUMS"), "utf8"));
    expect(git(f.root, "diff", "--name-only")).toBe("");
  }, 30_000);

  it("accepts a canonical repository root and an in-root directory alias", () => {
    const f = fixture();
    mkdirSync(join(f.root, "actual"));
    symlinkSync(join(f.root, "actual"), join(f.root, "alias"), "junction");
    expect(confinedReleasePath(f.root, "alias/new")).toBe(
      join(f.root, "actual", "new"),
    );
    expect(prepareReleaseOutput(f.root, "alias/new", "0.1.0")).toBe(
      join(f.root, "actual", "new"),
    );
  });

  it("rejects a publication manifest link before parsing it", () => {
    const f = fixture();
    mkdirSync(join(f.root, "output"));
    symlinkSync(
      f.outside,
      join(f.root, "output", "release-manifest.json"),
      "junction",
    );
    expect(() => verifiedReleaseInput(f.root, "output")).toThrow(
      "RELEASE_PATH_OUTSIDE_REPOSITORY",
    );
  });

  it("rejects private runner path arguments before reading or writing them", () => {
    const f = fixture();
    const runner = fileURLToPath(
      new URL("./release-it-runner.ts", import.meta.url),
    );
    const output = join(f.outside, "result.json");
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(require.resolve("tsx/esm")).href,
        runner,
        "missing-config",
        output,
      ],
      { cwd: f.root, encoding: "utf8", timeout: 30_000 },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Release-it runner does not accept arguments",
    );
    expect(existsSync(output)).toBe(false);
  });
  it("rejects an outside plan before reading its contents or creating output", () => {
    const f = fixture();
    const plan = join(f.outside, "plan.json");
    writeFileSync(plan, "not-json");
    const result = f.run("generate", "output", plan);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("RELEASE_PATH_OUTSIDE_REPOSITORY");
    expect(existsSync(join(f.root, "output"))).toBe(false);
  });

  it.each(["../source-neighbor/new/nested", "absolute"])(
    "rejects an outside output (%s) before creating any parent",
    async (variant) => {
      const f = fixture();
      writeFileSync(
        join(f.root, "release-plan.json"),
        JSON.stringify(
          await readReleasePlan(f.root, git(f.root, "rev-parse", "HEAD")),
        ),
      );
      const output =
        variant === "absolute" ? join(f.outside, "new", "nested") : variant;
      const result = f.run("generate", output);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("RELEASE_PATH_OUTSIDE_REPOSITORY");
      expect(existsSync(join(f.outside, "new"))).toBe(false);
    },
  );

  it("rejects a directory link with a nonexistent output tail", () => {
    const f = fixture();
    symlinkSync(f.outside, join(f.root, "linked"), "junction");
    const result = f.run("generate", "linked/new/nested");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("RELEASE_PATH_OUTSIDE_REPOSITORY");
    expect(existsSync(join(f.outside, "new"))).toBe(false);
  });

  it.skipIf(process.platform === "win32").each([false, true])(
    "rejects a linked artifact leaf (dangling: %s; requires file-symlink permission)",
    async (dangling) => {
      const f = fixture();
      const plan = await readReleasePlan(
        f.root,
        git(f.root, "rev-parse", "HEAD"),
      );
      writeFileSync(join(f.root, "release-plan.json"), JSON.stringify(plan));
      mkdirSync(join(f.root, "output"));
      const target = join(f.outside, "notes.md");
      if (!dangling) {
        writeFileSync(target, "untouched");
      }
      symlinkSync(target, join(f.root, "output", "release-notes.md"), "file");
      const result = f.run("generate", "output");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("RELEASE_PATH_OUTSIDE_REPOSITORY");
      expect(existsSync(target)).toBe(!dangling);
      if (!dangling) {
        expect(readFileSync(target, "utf8")).toBe("untouched");
      }
      expect(existsSync(join(f.root, "output", "release-manifest.json"))).toBe(
        false,
      );
    },
  );

  it("rejects path syntax in the release version before writing artifacts", async () => {
    const f = fixture();
    const plan = await readReleasePlan(
      f.root,
      git(f.root, "rev-parse", "HEAD"),
    );
    writeFileSync(
      join(f.root, "release-plan.json"),
      JSON.stringify({ ...plan, version: "../../outside" }),
    );
    const result = f.run("generate", "output");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("INVALID_RELEASE_VERSION");
    expect(existsSync(join(f.root, "output"))).toBe(false);
  });
});
