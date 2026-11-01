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

test("parallel collection preserves UTF-16 file order and repeated diagnostics", async () => {
  await withRepo(async (root) => {
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "docs", "é.md"), "[Missing](missing.md)");
    await writeFile(
      join(root, "docs", "Z.md"),
      "[Missing](missing.md) [Repeated](missing.md)",
    );
    await writeFile(join(root, "docs", "ignored.txt"), "[Ignored](missing.md)");
    const result = await validateMarkdownLinks({
      repoRoot: root,
      sourcePaths: ["docs"],
    });
    assert.equal(result.filesChecked, 2);
    assert.equal(result.linksChecked, 3);
    assert.deepEqual(result.errors, [
      "docs/Z.md: missing repository-relative target: missing.md",
      "docs/Z.md: missing repository-relative target: missing.md",
      "docs/é.md: missing repository-relative target: missing.md",
    ]);
  });
});

test("validates Unicode paths and malformed or escaping targets without counting external links", async () => {
  await withRepo(async (root) => {
    await writeFile(join(root, "é.md"), "# Target");
    await writeFile(
      join(root, "README.md"),
      [
        "[Unicode](%C3%A9.md) [Encoded](%E0%A4%A) [Escape](../outside.md)",
        "[External](https://example.invalid) [Mail](mailto:a@example.invalid) [Anchor](#part)",
        "`[Inline](hidden.md)`",
      ].join("\n"),
    );
    const result = await validateMarkdownLinks({
      repoRoot: root,
      sourcePaths: ["README.md", "missing-directory"],
    });
    assert.equal(result.linksChecked, 3);
    assert.deepEqual(result.errors, [
      "README.md: invalid URI encoding in link target %E0%A4%A",
      "README.md: link escapes repository root: ../outside.md",
    ]);
  });
});

for (const marker of ["`", "~"]) {
  test(`long Unicode-indented ${marker} fences hide links and preserve the following link`, async () => {
    await withRepo(async (root) => {
      await writeFile(join(root, "target.md"), "# Target\n");
      const fence = marker.repeat(3);
      await writeFile(
        join(root, "README.md"),
        [
          `${"\u00a0".repeat(100_000)}${fence} text`,
          "[Hidden](missing.md)",
          marker === "`" ? "~~~" : "```",
          "[Still hidden](also-missing.md)",
          fence,
          "[Visible](target.md)",
        ].join("\n"),
      );
      const result = await validateMarkdownLinks({
        repoRoot: root,
        sourcePaths: ["README.md"],
      });
      assert.deepEqual(result.errors, []);
      assert.equal(result.linksChecked, 1);
    });
  });
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
