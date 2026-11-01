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
import { basename, resolve } from "node:path";
import { after, test } from "node:test";

import { CI_SOURCES, mergeCoverage } from "./merge-coverage.mjs";

const root = mkdtempSync(resolve(tmpdir(), "architecture-lcov-"));
const outside = resolve(root, "..", `${basename(root)}-outside.ts`);
writeFileSync(outside, "export {};\n");
after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside);
});
for (const workspace of ["apps/api", "packages/contexts/iam"]) {
  mkdirSync(resolve(root, workspace, "src"), { recursive: true });
  writeFileSync(resolve(root, workspace, "src/index.ts"), "export {};\n");
}

test("distinguishes identical relative sources in different workspaces", () => {
  const output = mergeCoverage(
    ["apps/api", "packages/contexts/iam"].map((workspace) => ({
      path: `${workspace}/coverage/lcov.info`,
      content: "SF:src/index.ts\r\nDA:1,2\r\nend_of_record\r\n",
    })),
    root,
  );
  assert.match(output, /SF:apps\/api\/src\/index.ts/);
  assert.match(output, /SF:packages\/contexts\/iam\/src\/index.ts/);
  assert.equal(output.match(/DA:1,2/g).length, 2);
});

test("supports absolute sources from the same checkout", () => {
  assert.match(
    mergeCoverage(
      [
        {
          path: "apps/api/coverage/lcov.info",
          content: `SF:${resolve(root, "apps/api/src/index.ts")}\nDA:1,1\nend_of_record\n`,
        },
      ],
      root,
    ),
    /SF:apps\/api\/src\/index.ts/,
  );
});

test("rejects missing or escaped source paths instead of reporting false coverage", () => {
  for (const source of ["src/missing.ts", `../../../${basename(outside)}`]) {
    assert.throws(
      () =>
        mergeCoverage(
          [{ path: "apps/api/coverage/lcov.info", content: `SF:${source}\n` }],
          root,
        ),
      /Unresolvable LCOV source/,
    );
  }
});

test("rejects missing or empty coverage", () => {
  assert.throws(() => mergeCoverage([], root), /No workspace LCOV/);
  assert.throws(
    () =>
      mergeCoverage(
        [{ path: "apps/api/coverage/lcov.info", content: "" }],
        root,
      ),
    /no sources/,
  );
});

test("rejects an empty report alongside a valid report and malformed records", () => {
  const good = {
    path: "apps/api/coverage/lcov.info",
    content: "SF:src/index.ts\nDA:1,1\nend_of_record\n",
  };
  assert.throws(
    () => mergeCoverage([good, { ...good, content: "" }], root),
    /no sources/,
  );
  for (const content of [
    "SF:src/index.ts\n",
    "SF:src/index.ts\nDA:invalid\nend_of_record\n",
  ]) {
    assert.throws(
      () => mergeCoverage([{ ...good, content }], root),
      /Invalid LCOV/,
    );
  }
});

test("CLI rejects a missing report for a declared test workspace", () => {
  const workspace = resolve(root, "apps/api");
  writeFileSync(
    resolve(workspace, "package.json"),
    JSON.stringify({
      name: "api",
      scripts: { test: "vitest run", "test:coverage": "vitest run --coverage" },
    }),
  );
  const result = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, "merge-coverage.mjs")],
    { cwd: root, encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT.*lcov.info/);
});

test("combines workspace-relative and repository-relative reports without losing records", () => {
  const merged = mergeCoverage(
    [
      {
        path: "apps/api/coverage/lcov.info",
        content: "SF:src/index.ts\nDA:1,3\nend_of_record\n",
      },
      {
        path: "coverage/scripts/lcov.info",
        sourceRoot: ".",
        expectedSources: ["packages/contexts/iam/src/index.ts"],
        content:
          "SF:packages\\contexts\\iam\\src\\index.ts\nDA:1,7\nend_of_record\n",
      },
    ],
    root,
  );
  assert.match(merged, /SF:apps\/api\/src\/index.ts\nDA:1,3/);
  assert.match(merged, /SF:packages\/contexts\/iam\/src\/index.ts\nDA:1,7/);
});

test("rejects an incomplete native report, duplicate sources and repository-relative escapes", () => {
  const base = {
    path: "coverage/scripts/lcov.info",
    sourceRoot: ".",
    content: "SF:apps/api/src/index.ts\nDA:1,0\nend_of_record\n",
  };
  assert.throws(
    () => mergeCoverage([{ ...base, expectedSources: ["missing.mjs"] }], root),
    /Missing expected LCOV source/,
  );
  assert.throws(
    () =>
      mergeCoverage([{ ...base, content: base.content + base.content }], root),
    /Duplicate LCOV source/,
  );
  assert.throws(
    () =>
      mergeCoverage(
        [
          {
            ...base,
            content: `SF:../${basename(outside)}\nDA:1,1\nend_of_record\n`,
          },
        ],
        root,
      ),
    /Unresolvable LCOV source/,
  );
});

test("CLI requires native coverage and preserves workspace counters in its final output", (t) => {
  const checkout = mkdtempSync(resolve(tmpdir(), "architecture-coverage-cli-"));
  t.after(() => rmSync(checkout, { recursive: true, force: true }));
  mkdirSync(resolve(checkout, "apps/app/src"), { recursive: true });
  mkdirSync(resolve(checkout, "apps/app/coverage"), { recursive: true });
  writeFileSync(
    resolve(checkout, "apps/app/package.json"),
    JSON.stringify({
      name: "app",
      scripts: { test: "vitest run", "test:coverage": "vitest run --coverage" },
    }),
  );
  writeFileSync(resolve(checkout, "apps/app/src/index.ts"), "export {};\n");
  writeFileSync(
    resolve(checkout, "apps/app/coverage/lcov.info"),
    "SF:src/index.ts\nDA:1,9\nend_of_record\n",
  );
  const run = () =>
    spawnSync(
      process.execPath,
      [resolve(import.meta.dirname, "merge-coverage.mjs")],
      { cwd: checkout, encoding: "utf8" },
    );
  const missing = run();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /ENOENT.*lcov.info/);
  mkdirSync(resolve(checkout, "coverage/scripts"), { recursive: true });
  mkdirSync(resolve(checkout, "scripts"), { recursive: true });
  for (const source of CI_SOURCES)
    writeFileSync(resolve(checkout, source), "export {};\n");
  const reports = CI_SOURCES.map(
    (source) => `SF:${source}\nDA:1,2\nend_of_record\n`,
  );
  writeFileSync(
    resolve(checkout, "coverage/scripts/lcov.info"),
    reports.slice(1).join(""),
  );
  assert.notEqual(run().status, 0);
  writeFileSync(
    resolve(checkout, "coverage/scripts/lcov.info"),
    reports.join(""),
  );
  const complete = run();
  assert.equal(complete.status, 0, complete.stderr);
  const merged = readFileSync(resolve(checkout, "coverage/lcov.info"), "utf8");
  assert.match(merged, /SF:apps\/app\/src\/index.ts\nDA:1,9/);
  for (const source of CI_SOURCES)
    assert.ok(merged.includes(`SF:${source}\nDA:1,2`));
  assert.equal((merged.match(/^SF:/gm) ?? []).length, CI_SOURCES.length + 1);
});

test("rejects malformed, duplicate or incomplete line counters", () => {
  for (const counters of [
    "DA:1,1\nDA:broken\n",
    "DA:1,1\nDA:1,0\n",
    "DA:1,1\nLF:2\n",
  ]) {
    assert.throws(
      () =>
        mergeCoverage(
          [
            {
              path: "apps/api/coverage/lcov.info",
              content: `SF:src/index.ts\n${counters}end_of_record\n`,
            },
          ],
          root,
        ),
      /(?:Invalid|Incomplete) LCOV line counters/,
    );
  }
});

test("rejects a sourceless record even when global record and source counts match", () => {
  const content =
    "DA:1,1\nend_of_record\n" +
    "SF:apps/api/src/index.ts\nSF:packages/contexts/iam/src/index.ts\nDA:1,1\nend_of_record\n";
  assert.throws(
    () =>
      mergeCoverage(
        [{ path: "coverage/scripts/lcov.info", sourceRoot: ".", content }],
        root,
      ),
    /Invalid LCOV records/,
  );
});
