import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import type { FetchLike } from "./github-project-inventory.js";

const repository = "https://api.github.com/repos/Oxelio/architecture-web";
const sha = z.string().regex(/^[a-f0-9]{40}$/u);
const entry = z.object({
  path: z.string(),
  sha,
  type: z.string(),
  mode: z.string(),
});
type Entry = z.infer<typeof entry>;

// Protect the workflow and the files that determine what privileged code is
// installed and run. Product source is outside this comparison. Updating a
// lockfile or privileged dependency requires refreshing the accepted baseline.
const controlPaths = [
  ".github",
  ".gitmodules",
  ".npmrc",
  ".nvmrc",
  ".pnpmfile.cjs",
  "external",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts",
  "packages/tooling",
] as const;

export function createAuthoringControlVerifier(input: {
  readonly approvedRevision: string;
  readonly readToken?: string;
  readonly fetchImpl?: FetchLike;
}) {
  if (!sha.safeParse(input.approvedRevision).success) {
    throw new Error("AUTHORING_CONTROL_REVISION_INVALID");
  }
  async function get(path: string): Promise<unknown> {
    const response = await (input.fetchImpl ?? fetch)(`${repository}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(input.readToken
          ? { Authorization: `Bearer ${input.readToken}` }
          : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status !== 200) {
      throw new Error("AUTHORING_CONTROL_UNAVAILABLE");
    }
    return response.json() as Promise<unknown>;
  }
  async function tree(treeSha: string) {
    const value = z
      .object({ sha, truncated: z.literal(false), tree: z.array(entry) })
      .parse(await get(`/git/trees/${treeSha}`));
    const entries = new Map(value.tree.map((item) => [item.path, item]));
    if (value.sha !== treeSha || entries.size !== value.tree.length) {
      throw new Error("AUTHORING_CONTROL_TREE_UNVERIFIED");
    }
    return entries;
  }
  async function manifest(revision: string) {
    const commit = z
      .object({ sha, tree: z.object({ sha }) })
      .parse(await get(`/git/commits/${revision}`));
    if (commit.sha !== revision) {
      throw new Error("AUTHORING_CONTROL_COMMIT_UNVERIFIED");
    }
    const root = await tree(commit.tree.sha);
    const packages = root.get("packages");
    if (packages?.type !== "tree" || packages.mode !== "040000") {
      throw new Error("AUTHORING_CONTROL_TREE_UNVERIFIED");
    }
    const packageTree = await tree(packages.sha);
    return controlPaths.map((path) => {
      const found: Entry | undefined =
        path === "packages/tooling"
          ? packageTree.get("tooling")
          : root.get(path);
      if (!found && path !== ".npmrc" && path !== ".pnpmfile.cjs") {
        throw new Error("AUTHORING_CONTROL_PATH_MISSING");
      }
      return found ?? null;
    });
  }
  return async (revision: string) => {
    if (!sha.safeParse(revision).success) {
      return false;
    }
    try {
      const approved = await manifest(input.approvedRevision);
      return (
        revision === input.approvedRevision ||
        isDeepStrictEqual(approved, await manifest(revision))
      );
    } catch {
      return false;
    }
  };
}
