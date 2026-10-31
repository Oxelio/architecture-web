import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { after, test } from "node:test";

import { mergeCoverage } from "./merge-coverage.mjs";

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
