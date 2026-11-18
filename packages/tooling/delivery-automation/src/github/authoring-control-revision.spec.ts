import { expect, it } from "vitest";

import { createAuthoringControlVerifier } from "./authoring-control-revision.js";

it("accepts a product-only main revision and rejects changed privileged inputs or incomplete trees", async () => {
  const approved = "a".repeat(40);
  const product = "b".repeat(40);
  const changed = "c".repeat(40);
  const incomplete = "d".repeat(40);
  const tooling = "e".repeat(40);
  const path = (name: string, sha: string, tree = false) => ({
    path: name,
    sha,
    type: tree ? "tree" : "blob",
    mode: tree ? "040000" : "100644",
  });
  const verify = createAuthoringControlVerifier({
    approvedRevision: approved,
    fetchImpl: async (url) => {
      const [endpoint, sha] = new URL(String(url)).pathname
        .split("/")
        .slice(-2);
      if (endpoint === "commits") {
        return Response.json({ sha, tree: { sha } });
      }
      if (sha === tooling) {
        return Response.json({
          sha,
          truncated: false,
          tree: [path("tooling", "0".repeat(40), true)],
        });
      }
      return Response.json({
        sha,
        truncated: sha === incomplete,
        tree: [
          path(".github", sha === changed ? changed : approved, true),
          path("scripts", approved, true),
          path(".gitmodules", approved),
          path(".nvmrc", approved),
          path("external", approved, true),
          path("package.json", approved),
          path("pnpm-lock.yaml", approved),
          path("pnpm-workspace.yaml", approved),
          path("packages", tooling, true),
          path("apps", sha ?? incomplete, true),
        ],
      });
    },
  });
  expect(await verify(product)).toBe(true);
  expect(await verify(changed)).toBe(false);
  expect(await verify(incomplete)).toBe(false);
});
