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

import { qualityGate } from "./quality-gate.mjs";
import { runIntegrationTests } from "./run-integration-tests.mjs";
import { runWorkspaceTests } from "./run-workspace-tests.mjs";

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
