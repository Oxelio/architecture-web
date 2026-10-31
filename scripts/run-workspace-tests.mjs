import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  globSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export function execute(command, args, options) {
  // npm_execpath is supplied by pnpm, including on Windows: no shell is needed.
  if (command === "pnpm") {
    if (!options.env.npm_execpath)
      throw new Error("Run this command through pnpm");
    if (/\.[cm]?js$/u.test(options.env.npm_execpath)) {
      args = [options.env.npm_execpath, ...args];
      command = process.execPath;
    } else {
      command = options.env.npm_execpath;
    }
  }
  const result = spawnSync(command, args, { ...options, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}

export function testWorkspaces(root) {
  const manifests = globSync(
    ["apps/**/package.json", "packages/**/package.json"],
    {
      cwd: root,
      exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
    },
  ).sort();
  const workspaces = manifests
    .map((path) => ({
      path: dirname(path),
      ...JSON.parse(readFileSync(resolve(root, path), "utf8")),
    }))
    .filter((workspace) => workspace.scripts?.test);
  if (!workspaces.length) throw new Error("No test workspaces were discovered");
  for (const workspace of workspaces) {
    if (!workspace.scripts["test:coverage"]) {
      throw new Error(`Missing test:coverage script: ${workspace.name}`);
    }
  }
  return workspaces;
}

export function runWorkspaceTests({
  root = process.cwd(),
  env = process.env,
  run = execute,
} = {}) {
  const workspaces = testWorkspaces(root);
  const temporary = mkdtempSync(resolve(tmpdir(), "architecture-ci-tests-"));
  const rows = [];
  let status = 0;
  try {
    for (const [index, workspace] of workspaces.entries()) {
      const cwd = resolve(root, workspace.path);
      const coverage = resolve(cwd, "coverage");
      const local = relative(root, coverage);
      if (!local || local === ".." || local.startsWith(`..${sep}`)) {
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
      let tests = 0;
      let files = 0;
      let passed = result === 0;
      try {
        const data = JSON.parse(readFileSync(report, "utf8"));
        tests = data.numTotalTests;
        files = data.testResults.length;
        passed &&=
          data.success === true &&
          Number.isInteger(tests) &&
          tests > 0 &&
          data.numPassedTests > 0 &&
          data.numFailedTests === 0 &&
          files > 0;
      } catch {
        passed = false;
      }
      if (!passed) status = 1;
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
    if (env.GITHUB_STEP_SUMMARY)
      appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
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
    console.error(error.message);
    process.exitCode = 1;
  }
}
