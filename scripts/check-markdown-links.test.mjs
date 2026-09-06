import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { validateMarkdownLinks } from "./check-markdown-links.mjs";

async function withRepo(run) {
  const root = await mkdtemp(join(tmpdir(), "markdown-links-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("valid repository-relative links pass", async () => {
  await withRepo(async (root) => {
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "README.md"), "[Guide](docs/guide.md)\n");
    await writeFile(
      join(root, "docs", "guide.md"),
      "[Top](../README.md#top)\n",
    );

    const result = await validateMarkdownLinks({
      repoRoot: root,
      sourcePaths: ["README.md", "docs"],
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.linksChecked, 2);
  });
});

test("missing repository-relative targets fail closed", async () => {
  await withRepo(async (root) => {
    await writeFile(join(root, "README.md"), "[Missing](docs/missing.md)\n");

    const result = await validateMarkdownLinks({
      repoRoot: root,
      sourcePaths: ["README.md"],
    });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /missing repository-relative target/u);
  });
});

test("removed docs/method paths fail even if a target exists", async () => {
  await withRepo(async (root) => {
    await mkdir(join(root, "docs", "method"), { recursive: true });
    await writeFile(join(root, "docs", "method", "README.md"), "# Legacy\n");
    await writeFile(
      join(root, "README.md"),
      "[Legacy](docs/method/README.md)\n",
    );

    const result = await validateMarkdownLinks({
      repoRoot: root,
      sourcePaths: ["README.md"],
    });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /removed legacy Method path is forbidden/u);
  });
});

test("missing Method submodule targets report the checkout requirement", async () => {
  await withRepo(async (root) => {
    await mkdir(join(root, "docs", "project"), { recursive: true });
    await writeFile(
      join(root, "docs", "project", "profile.md"),
      "[Method](../../external/software-engineering-method/README.md)\n",
    );

    const result = await validateMarkdownLinks({
      repoRoot: root,
      sourcePaths: ["docs/project/profile.md"],
    });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Method submodule target is unavailable/u);
  });
});
