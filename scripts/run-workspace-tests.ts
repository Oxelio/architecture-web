import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  globSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export interface CommandOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: CommandOptions,
) => number;

export interface WorkspaceTestOptions {
  root?: string;
  env?: NodeJS.ProcessEnv;
  run?: CommandRunner;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function execute(
  command: string,
  args: string[],
  options: CommandOptions,
) {
  // npm_execpath is supplied by pnpm, including on Windows: no shell is needed.
  if (command === "pnpm") {
    if (!options.env.npm_execpath) {
      throw new Error("Run this command through pnpm");
    }
    if (/\.[cm]?js$/u.test(options.env.npm_execpath)) {
      args = [options.env.npm_execpath, ...args];
      command = process.execPath;
    } else {
      command = options.env.npm_execpath;
    }
  }
  const result = spawnSync(command, args, { ...options, stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
  }
  return result.status ?? 1;
}

export function testWorkspaces(root: string) {
  const manifests = globSync(
    ["apps/**/package.json", "packages/**/package.json"],
    {
      cwd: root,
      exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
    },
  ).sort((a, b) => Number(a > b) - Number(a < b));
  const workspaces = manifests.flatMap<
    Record<string, unknown> & { scripts: Record<string, unknown> }
  >((path) => {
    const manifest: unknown = JSON.parse(
      readFileSync(resolve(root, path), "utf8"),
    );
    const workspace: Record<string, unknown> = {
      path: dirname(path),
      ...(isRecord(manifest) ? manifest : {}),
    };
    const scripts = workspace["scripts"];
    if (!isRecord(scripts) || !scripts["test"]) {
      return [];
    }
    return [{ ...workspace, scripts }];
  });
  if (!workspaces.length) {
    throw new Error("No test workspaces were discovered");
  }
  return workspaces.map((workspace) => {
    const path = workspace["path"];
    const name = workspace["name"];
    if (typeof path !== "string") {
      throw new TypeError("Invalid test workspace path");
    }
    if (typeof name !== "string") {
      throw new TypeError(`Invalid test workspace name: ${path}`);
    }
    if (!workspace.scripts["test:coverage"]) {
      throw new Error(`Missing test:coverage script: ${name}`);
    }
    return { ...workspace, path, name };
  });
}

interface ExecutionReport {
  tests: number;
  files: number;
  passed: boolean;
}

function readExecutionReport(path: string, status: number): ExecutionReport {
  try {
    const data: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(data)) {
      throw new Error("Invalid execution report");
    }
    const tests = data["numTotalTests"];
    const testResults = data["testResults"];
    if (
      typeof tests !== "number" ||
      !Number.isInteger(tests) ||
      tests < 0 ||
      !Array.isArray(testResults)
    ) {
      throw new Error("Invalid execution report");
    }
    const files = testResults.length;
    const passedTests = data["numPassedTests"];
    const passed =
      status === 0 &&
      data["success"] === true &&
      tests > 0 &&
      typeof passedTests === "number" &&
      Number.isInteger(passedTests) &&
      passedTests > 0 &&
      data["numFailedTests"] === 0 &&
      files > 0;
    return { tests, files, passed };
  } catch {
    return { tests: 0, files: 0, passed: false };
  }
}

export function isCoverageWithinCheckout(
  root: string,
  coverage: string,
  paths = { relative, isAbsolute, sep },
) {
  const local = paths.relative(root, coverage);
  return (
    local !== "" &&
    !paths.isAbsolute(local) &&
    local !== ".." &&
    !local.startsWith(`..${paths.sep}`)
  );
}

export function runWorkspaceTests({
  root = process.cwd(),
  env = process.env,
  run = execute,
}: WorkspaceTestOptions = {}) {
  const workspaces = testWorkspaces(root);
  const temporary = mkdtempSync(resolve(tmpdir(), "architecture-ci-tests-"));
  const rows: string[] = [];
  let status = 0;
  try {
    for (const [index, workspace] of workspaces.entries()) {
      const cwd = resolve(root, workspace.path);
      const coverage = resolve(cwd, "coverage");
      if (!isCoverageWithinCheckout(root, coverage)) {
        throw new Error("Coverage directory escapes repository");
      }
      rmSync(coverage, { recursive: true, force: true });
      const report = resolve(temporary, `${index}.json`);
      const result = run(
        "pnpm",
        [
          "run",
          "test:coverage",
          "--reporter=default",
          "--reporter=json",
          ...(env.GITHUB_ACTIONS ? ["--reporter=github-actions"] : []),
          `--outputFile.json=${report}`,
        ],
        { cwd, env },
      );
      const { tests, files, passed } = readExecutionReport(report, result);
      if (!passed) {
        status = 1;
      }
      rows.push(
        `| \`${workspace.name}\` | \`${workspace.path}\` | ${files} | ${tests} | ${passed ? "PASS" : "FAIL"} |`,
      );
    }
    const summary = [
      "## Repository test validation",
      "",
      `Overall result: ${status ? "FAIL" : "PASS"}`,
      "",
      "| Workspace | Path | Test files | Tests | Result |",
      "| --- | --- | ---: | ---: | --- |",
      ...rows,
      "",
    ].join("\n");
    console.log(summary);
    if (env.GITHUB_STEP_SUMMARY) {
      appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
    }
    return status;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = runWorkspaceTests();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
