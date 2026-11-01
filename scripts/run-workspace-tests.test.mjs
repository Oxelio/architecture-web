import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { qualityGate } from "./quality-gate.mjs";
import { runIntegrationTests } from "./run-integration-tests.mjs";
import { execute, runWorkspaceTests } from "./run-workspace-tests.mjs";

function fixture(
  t,
  scripts = [{ test: "vitest run", "test:coverage": "vitest run --coverage" }],
) {
  const root = mkdtempSync(resolve(tmpdir(), "architecture-ci-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [index, commands] of scripts.entries()) {
    const path = resolve(root, "apps", `app-${index}`);
    mkdirSync(path, { recursive: true });
    writeFileSync(
      resolve(path, "package.json"),
      JSON.stringify({ name: `app-${index}`, scripts: commands }),
    );
  }
  return root;
}

function report(
  args,
  data = {
    success: true,
    numTotalTests: 2,
    numPassedTests: 2,
    numFailedTests: 0,
    testResults: [{}],
  },
) {
  const path = args
    .find((arg) => arg.startsWith("--outputFile.json="))
    ?.slice("--outputFile.json=".length);
  writeFileSync(path, JSON.stringify(data));
}

test("rejects missing coverage commands and an empty test inventory before execution", (t) => {
  for (const scripts of [[], [{ test: "vitest run" }]]) {
    assert.throws(
      () =>
        runWorkspaceTests({
          root: fixture(t, scripts),
          run: () => assert.fail("must not execute"),
        }),
      /No test workspaces|Missing test:coverage/,
    );
  }
});

test("records every workspace, removes stale coverage and propagates a command failure", (t) => {
  const root = fixture(
    t,
    Array(2).fill({
      test: "vitest run",
      "test:coverage": "vitest run --coverage",
    }),
  );
  const stale = resolve(root, "apps/app-0/coverage");
  mkdirSync(stale);
  writeFileSync(resolve(stale, "lcov.info"), "stale");
  const summary = resolve(root, "summary.md");
  let count = 0;
  const status = runWorkspaceTests({
    root,
    env: { GITHUB_STEP_SUMMARY: summary, GITHUB_ACTIONS: "true" },
    run: (_command, args) => {
      assert.ok(args.includes("--reporter=github-actions"));
      assert.throws(() => readFileSync(resolve(stale, "lcov.info")), /ENOENT/);
      report(args);
      return count++ === 0 ? 7 : 0;
    },
  });
  assert.equal(count, 2);
  assert.equal(status, 1);
  assert.match(readFileSync(summary, "utf8"), /app-0.*FAIL[\s\S]*app-1.*PASS/);
});

test("rejects zero executed tests and missing or invalid execution reports", (t) => {
  for (const data of [
    null,
    {
      success: true,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      testResults: [],
    },
    {
      success: true,
      numTotalTests: 2,
      numPassedTests: 0,
      numFailedTests: 0,
      testResults: [{}],
    },
    { success: false, numTotalTests: 2, testResults: [{}] },
  ]) {
    assert.equal(
      runWorkspaceTests({
        root: fixture(t),
        env: {},
        run: (_command, args) => {
          if (data) report(args, data);
          return 0;
        },
      }),
      1,
    );
  }
});

test("accepts a successful workspace run", (t) => {
  assert.equal(
    runWorkspaceTests({
      root: fixture(t),
      env: {},
      run: (_command, args) => {
        report(args);
        return 0;
      },
    }),
    0,
  );
});

test("service startup failure skips tests, returns failure and still cleans up", () => {
  const calls = [];
  const status = runIntegrationTests({
    run: (_command, args) => {
      calls.push(args);
      return calls.length === 1 ? 4 : 0;
    },
    test: () => assert.fail("tests must not run after startup failure"),
  });
  assert.equal(status, 4);
  assert.ok(calls[0].includes("--wait"));
  assert.deepEqual(calls[1].slice(-2), ["down", "--volumes"]);
});

test("uses disposable endpoints and propagates test and cleanup failures", () => {
  for (const [testStatus, cleanupStatus, expected] of [
    [5, 0, 5],
    [0, 6, 6],
    [0, 0, 0],
  ]) {
    let calls = 0;
    assert.equal(
      runIntegrationTests({
        env: { IAM_INTEGRATION_DATABASE_URL: "must-not-use" },
        run: () => (calls++ === 0 ? 0 : cleanupStatus),
        test: ({ env }) => {
          assert.equal(env.TZ, "UTC");
          assert.match(
            env.IAM_INTEGRATION_DATABASE_URL,
            /127\.0\.0\.1:55432\/iam_refactor_test$/,
          );
          assert.equal(
            env.IAM_INTEGRATION_REDIS_URL,
            "redis://127.0.0.1:56379/15",
          );
          return testStatus;
        },
      }),
      expected,
    );
    assert.equal(calls, 2);
  }
});

test("cleans up when the test runner throws", () => {
  let calls = 0;
  assert.throws(
    () =>
      runIntegrationTests({
        run: () => {
          calls++;
          return 0;
        },
        test: () => {
          throw new Error("test failure");
        },
      }),
    /test failure/,
  );
  assert.equal(calls, 2);
});

test("quality gate rejects failed, cancelled, missing and unexpectedly skipped required checks", () => {
  const good = {
    event: "pull_request",
    validation: "success",
    dependencyReview: "success",
    commitlint: "success",
  };
  assert.equal(qualityGate(good), true);
  for (const key of ["validation", "dependencyReview", "commitlint"]) {
    for (const result of ["failure", "cancelled", "skipped", undefined]) {
      assert.equal(qualityGate({ ...good, [key]: result }), false);
    }
  }
  for (const event of ["push", "workflow_dispatch"]) {
    assert.equal(
      qualityGate({
        event,
        validation: "success",
        dependencyReview: "skipped",
        commitlint: "skipped",
      }),
      true,
    );
  }
  // Sonar is not an input to required-check acceptance.
  assert.equal(qualityGate({ ...good, sonar: "failure" }), true);
  const child = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, "quality-gate.mjs")],
    {
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "pull_request",
        VALIDATION_RESULT: "success",
        DEPENDENCY_REVIEW_RESULT: "failure",
        COMMITLINT_RESULT: "success",
      },
    },
  );
  assert.equal(child.status, 1);
});

test("command execution preserves exit status and reports launch failures", (t) => {
  const cwd = fixture(t);
  assert.equal(
    execute(process.execPath, ["-e", "process.exit(7)"], {
      cwd,
      env: process.env,
    }),
    7,
  );
  assert.equal(
    execute(resolve(cwd, "missing-executable"), [], { cwd, env: process.env }),
    1,
  );
  assert.throws(() => execute("pnpm", [], { cwd, env: {} }), /through pnpm/);
});

test("command execution supports both JavaScript and native pnpm entrypoints without a shell", (t) => {
  const cwd = fixture(t);
  const entry = resolve(cwd, "pnpm.cjs");
  const result = resolve(cwd, "arguments.json");
  writeFileSync(
    entry,
    "require('node:fs').writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)));process.exit(4);",
  );
  assert.equal(
    execute("pnpm", [result, "literal;argument"], {
      cwd,
      env: { ...process.env, npm_execpath: entry },
    }),
    4,
  );
  assert.deepEqual(JSON.parse(readFileSync(result, "utf8")), [
    "literal;argument",
  ]);
  assert.equal(
    execute("pnpm", ["-e", "process.exit(3)"], {
      cwd,
      env: { ...process.env, npm_execpath: process.execPath },
    }),
    3,
  );
});

test("malformed execution JSON fails the workspace and summary write errors propagate", (t) => {
  const root = fixture(t);
  assert.equal(
    runWorkspaceTests({
      root,
      env: {},
      run: (_command, args) => {
        const path = args
          .find((arg) => arg.startsWith("--outputFile.json="))
          .slice("--outputFile.json=".length);
        writeFileSync(path, "invalid JSON");
        return 0;
      },
    }),
    1,
  );
  assert.throws(
    () =>
      runWorkspaceTests({
        root,
        env: { GITHUB_STEP_SUMMARY: root },
        run: (_command, args) => {
          report(args);
          return 0;
        },
      }),
    /EISDIR|EPERM|EACCES/,
  );
});

test("workspace CLI fails explicitly when its checkout has no test workspaces", (t) => {
  const root = fixture(t, []);
  const result = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, "run-workspace-tests.mjs")],
    { cwd: root, env: process.env, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No test workspaces/);
});

test("refuses a workspace path that would delete coverage outside the checkout", (t) => {
  const root = fixture(t);
  writeFileSync(
    resolve(root, "apps/app-0/package.json"),
    JSON.stringify({
      name: "escaped",
      path: "..",
      scripts: { test: "vitest run", "test:coverage": "vitest run --coverage" },
    }),
  );
  assert.throws(
    () =>
      runWorkspaceTests({
        root,
        run: () => assert.fail("must not execute outside checkout"),
      }),
    /escapes repository/,
  );
});

test("integration CLI propagates a Docker launch failure", (t) => {
  const root = fixture(t, []);
  const result = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, "run-integration-tests.mjs")],
    { cwd: root, env: { ...process.env, PATH: "" }, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /docker/);
});

test("integration CLI cleans up when checkout validation throws", (t) => {
  const root = fixture(t, []);
  const calls = resolve(root, "docker-calls.jsonl");
  const preload = resolve(root, "docker-stub.mjs");
  // Stub only the process boundary; execute the real CLI and its error handling.
  writeFileSync(
    preload,
    `import childProcess from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
childProcess.spawnSync = (command, args) => {
  if (command !== 'docker') throw new Error('Unexpected command');
  appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
  return { status: 0 };
};
syncBuiltinESMExports();`,
  );
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(preload).href,
      resolve(import.meta.dirname, "run-integration-tests.mjs"),
    ],
    { cwd: root, env: process.env, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No test workspaces/);
  const commands = readFileSync(calls, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.ok(commands[0].includes("up"));
  assert.deepEqual(commands[1].slice(-2), ["down", "--volumes"]);
});
