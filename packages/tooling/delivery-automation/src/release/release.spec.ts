import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { x } from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  generateArtifacts,
  readVerifiedArtifacts,
  sha256,
  workspaceManifests,
} from "./artifacts.js";
import {
  pendingRelease,
  publishRelease,
  type ReleaseFetch,
  ReleaseGitHub,
} from "./github.js";
import { git, pushReleaseTag, readReleasePlan } from "./repository.js";

const allocated: string[] = [];
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Missing fixture value");
  }
  return value;
}
afterEach(() => {
  for (const path of allocated.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function fixture() {
  const temporary = mkdtempSync(join(tmpdir(), "release-test-"));
  allocated.push(temporary);
  const root = join(temporary, "source"),
    remote = join(temporary, "remote.git");
  mkdirSync(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Release Test");
  git(root, "config", "user.email", "release@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  mkdirSync(join(root, "packages", "example"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "fixture", private: true, version: "0.1.0" }),
  );
  writeFileSync(
    join(root, "pnpm-workspace.yaml"),
    'packages:\n  - "packages/*"\n',
  );
  writeFileSync(
    join(root, "packages/example/package.json"),
    JSON.stringify({
      name: "example",
      version: "0.1.0",
      dependencies: { internal: "workspace:*" },
    }),
  );
  git(root, "add", ".");
  git(root, "commit", "-m", "feat: initial application (#1)");
  git(temporary, "init", "--bare", remote);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-u", "origin", "main");
  return { root, remote, temporary, sha: git(root, "rev-parse", "HEAD") };
}

function remoteApi(root: string, remote: string) {
  let release: { id: number; body: string; draft: boolean } | null = null;
  const assets = new Map<number, { name: string; bytes: Uint8Array }>();
  const writes: string[] = [];
  let failUpload = false;
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status });
  const transport: ReleaseFetch = async (url, options) => {
    const parsed = new URL(String(url));
    const path = parsed.pathname.replace("/repos/example/project", "");
    const method = options?.method ?? "GET";
    if (method !== "GET") {
      writes.push(`${method} ${path}`);
    }
    if (path === "/git/matching-refs/tags/v") {
      return json(
        git(
          remote,
          "for-each-ref",
          "--format=%(refname) %(objectname)",
          "refs/tags/v*",
        )
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [ref, sha] = line.split(" ");
            return { ref, object: { type: "tag", sha } };
          }),
      );
    }
    if (path.startsWith("/git/tags/") && method === "GET") {
      const data = git(
        remote,
        "cat-file",
        "-p",
        required(path.split("/").at(-1)),
      );
      return json({
        message: data.slice(data.indexOf("\n\n") + 2),
        object: { type: "commit", sha: required(data.split("\n")[0]).slice(7) },
      });
    }
    if (path.startsWith("/releases/tags/")) {
      return release ? json(release) : json({}, 404);
    }
    if (path === "/git/tags" && method === "POST") {
      const body = JSON.parse(String(options?.body)) as {
        tag: string;
        object: string;
        message: string;
      };
      git(root, "tag", "-a", body.tag, body.object, "-m", body.message);
      return json({ sha: git(root, "rev-parse", body.tag) });
    }
    if (path === "/git/refs" && method === "POST") {
      const body = JSON.parse(String(options?.body)) as { ref: string };
      pushReleaseTag(root, "origin", body.ref.slice("refs/tags/".length));
      return json({});
    }
    if (path === "/releases" && method === "POST") {
      release = {
        id: 1,
        ...(JSON.parse(String(options?.body)) as {
          body: string;
          draft: boolean;
        }),
      };
      return json(release);
    }
    if (path === "/releases/1/assets" && method === "GET") {
      return json([...assets].map(([id, asset]) => ({ id, name: asset.name })));
    }
    if (path.startsWith("/releases/assets/")) {
      return new Response(
        new Blob([
          new Uint8Array(
            required(assets.get(Number(path.split("/").at(-1)))).bytes,
          ),
        ]),
      );
    }
    if (
      parsed.hostname === "uploads.github.com" &&
      path === "/releases/1/assets"
    ) {
      if (failUpload) {
        failUpload = false;
        return json({}, 503);
      }
      const data = new Uint8Array(
        await (required(options).body as Blob).arrayBuffer(),
      );
      assets.set(assets.size + 1, {
        name: required(parsed.searchParams.get("name")),
        bytes: data,
      });
      return json({});
    }
    if (path === "/releases/1" && method === "PATCH" && release) {
      release.draft = false;
      return json(release);
    }
    throw new Error(`Unexpected fixture request: ${method} ${path}`);
  };
  return {
    client: new ReleaseGitHub("example/project", "fixture", transport),
    writes,
    assets,
    failNextUpload: () => {
      failUpload = true;
    },
  };
}

describe("release source pipeline", () => {
  it("discovers all actual manifests and binds first-stable authorization to its source SHA", async () => {
    expect(
      workspaceManifests(resolve(import.meta.dirname, "../../../../..")),
    ).toHaveLength(24);
    const f = fixture();
    await expect(
      readReleasePlan(f.root, f.sha, {
        actor: "maintainer",
        runId: "123",
        sourceSha: "a".repeat(40),
      }),
    ).rejects.toThrow("FIRST_STABLE_SHA_MISMATCH");
  });

  it("rejects a prerelease tag even when it points at the current source", async () => {
    const f = fixture();
    git(f.root, "tag", "v1.0.0-alpha.1");
    await expect(readReleasePlan(f.root, f.sha)).rejects.toThrow(
      "UNSUPPORTED_RELEASE_BASE",
    );
  });
  it("generates reproducible stamped sources with release-it and leaves the source checkout untouched", async () => {
    const f = fixture();
    git(f.root, "tag", "v0.1.0");
    writeFileSync(join(f.root, "change.txt"), "feature\n");
    git(f.root, "add", ".");
    git(f.root, "commit", "-m", "feat: next capability (#2)");
    const plan = await readReleasePlan(
      f.root,
      git(f.root, "rev-parse", "HEAD"),
    );
    expect(plan.version).toBe("0.2.0");
    const a = join(f.temporary, "a"),
      b = join(f.temporary, "b");
    await generateArtifacts(f.root, plan, a);
    await generateArtifacts(f.root, plan, b);
    expect(sha256(join(a, "SHA256SUMS"))).toBe(sha256(join(b, "SHA256SUMS")));
    expect(readVerifiedArtifacts(a).plan).toEqual(plan);
    const extracted = join(f.temporary, "extracted");
    mkdirSync(extracted);
    await x({
      cwd: extracted,
      file: join(a, "architecture-web-0.2.0-source.tar.gz"),
    });
    const pkg = JSON.parse(
      readFileSync(
        join(extracted, "architecture-web-0.2.0/packages/example/package.json"),
        "utf8",
      ),
    ) as { version: string; dependencies: { internal: string } };
    expect(pkg.version).toBe("0.2.0");
    expect(pkg.dependencies.internal).toBe("workspace:*");
    expect(git(f.root, "status", "--porcelain")).toBe("");
    expect(
      JSON.parse(readFileSync(join(f.root, "package.json"), "utf8")) as unknown,
    ).toMatchObject({ version: "0.1.0" });
    expect(readFileSync(join(a, "release-notes.md"), "utf8")).toContain(
      "next capability",
    );
    expect(readFileSync(join(a, "release-notes.md"), "utf8")).not.toContain(
      "initial application",
    );
  }, 30_000);

  it("publishes only a tag to a real temporary remote and resumes a partial release without duplicate tags or branch pushes", async () => {
    const f = fixture(),
      api = remoteApi(f.root, f.remote);
    const plan = await readReleasePlan(f.root, f.sha);
    const output = join(f.temporary, "assets");
    await generateArtifacts(f.root, plan, output);
    api.failNextUpload();
    await expect(publishRelease(f.root, output, api.client)).rejects.toThrow(
      "UPLOAD_FAILED",
    );
    expect((await pendingRelease(api.client))?.plan).toEqual(plan);
    const resumedOutput = join(f.temporary, "regenerated-assets");
    const resumedPlan = await readReleasePlan(f.root, f.sha, null, plan.tag);
    await generateArtifacts(f.root, resumedPlan, resumedOutput);
    expect(readFileSync(join(resumedOutput, "release-notes.md"), "utf8")).toBe(
      readFileSync(join(output, "release-notes.md"), "utf8"),
    );
    expect(sha256(join(resumedOutput, "SHA256SUMS"))).toBe(
      sha256(join(output, "SHA256SUMS")),
    );
    await publishRelease(f.root, resumedOutput, api.client);
    const writes = api.writes.length;
    await publishRelease(f.root, output, api.client);
    expect(api.writes).toHaveLength(writes);
    expect(api.writes.filter((line) => line === "POST /git/refs")).toHaveLength(
      1,
    );
    expect(git(f.remote, "rev-parse", "refs/heads/main")).toBe(f.sha);
    expect(git(f.remote, "rev-parse", "v0.1.0^{commit}")).toBe(f.sha);
    expect(api.assets.size).toBe(4);
    const first = required([...api.assets.values()][0]);
    first.bytes = new Uint8Array([1, 2, 3]);
    await expect(publishRelease(f.root, output, api.client)).rejects.toThrow(
      "REMOTE_RELEASE_ASSET_CONFLICT",
    );
    expect(api.writes).toHaveLength(writes);
    const manifestPath = join(output, "release-manifest.json");
    const altered = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      methodRevision: string | null;
    };
    altered.methodRevision = "b".repeat(40);
    writeFileSync(manifestPath, `${JSON.stringify(altered, null, 2)}\n`);
    const names = [
      "architecture-web-0.1.0-source.tar.gz",
      "release-notes.md",
      "release-manifest.json",
    ].sort();
    writeFileSync(
      join(output, "SHA256SUMS"),
      names.map((name) => `${sha256(join(output, name))}  ${name}\n`).join(""),
    );
    await expect(publishRelease(f.root, output, api.client)).rejects.toThrow(
      "RELEASE_TAG_CONFLICT",
    );
    expect(api.writes).toHaveLength(writes);
  }, 30_000);

  it("rejects altered local artifacts before any remote mutation", async () => {
    const f = fixture(),
      api = remoteApi(f.root, f.remote);
    const output = join(f.temporary, "assets");
    await generateArtifacts(
      f.root,
      await readReleasePlan(f.root, f.sha),
      output,
    );
    writeFileSync(join(output, "release-notes.md"), "tampered");
    await expect(publishRelease(f.root, output, api.client)).rejects.toThrow(
      "CHECKSUM_MISMATCH",
    );
    expect(api.writes).toEqual([]);
  }, 30_000);

  it("does not treat an ordinary first-stable workflow run or bot as human authorization", async () => {
    const transport: ReleaseFetch = async (url) =>
      new Response(
        JSON.stringify(
          String(url).includes("/permission")
            ? { role_name: "admin", user: { type: "User" } }
            : {
                event: "push",
                head_sha: "a".repeat(40),
                actor: { login: "maintainer", type: "User" },
                path: ".github/workflows/release.yml",
              },
        ),
      );
    await expect(
      new ReleaseGitHub(
        "example/project",
        "fixture",
        transport,
      ).verifyFirstStable({
        actor: "maintainer",
        runId: "1",
        sourceSha: "a".repeat(40),
      }),
    ).rejects.toThrow("HUMAN_MAINTAINER_DISPATCH");
  });

  it.each([
    ["User", "admin", "a".repeat(40), true],
    ["Bot", "admin", "a".repeat(40), false],
    ["User", "write", "a".repeat(40), false],
    ["User", "maintain", "b".repeat(40), false],
  ])(
    "verifies first-stable dispatch actor %s with role %s and exact SHA",
    async (type, role, sha, valid) => {
      const transport: ReleaseFetch = async (url) =>
        new Response(
          JSON.stringify(
            String(url).includes("/permission")
              ? { role_name: role, user: { type } }
              : {
                  event: "workflow_dispatch",
                  head_sha: sha,
                  actor: { login: "maintainer", type },
                  path: ".github/workflows/release.yml",
                },
          ),
        );
      const verification = new ReleaseGitHub(
        "example/project",
        "fixture",
        transport,
      ).verifyFirstStable({
        actor: "maintainer",
        runId: "123",
        sourceSha: "a".repeat(40),
      });
      if (valid) {
        await expect(verification).resolves.toBeUndefined();
      } else {
        await expect(verification).rejects.toThrow("HUMAN_MAINTAINER_DISPATCH");
      }
    },
  );

  it("keeps validation before publication and scopes the write credential to the publisher", () => {
    const workflow = parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../../../../../.github/workflows/release.yml",
        ),
        "utf8",
      ),
    ) as {
      jobs: Record<
        string,
        {
          permissions?: { contents: string };
          needs?: string[];
          steps: { run?: string }[];
        }
      >;
    };
    expect(required(workflow.jobs["plan"]).permissions?.contents).toBe("read");
    expect(required(workflow.jobs["publish"]).permissions?.contents).toBe(
      "write",
    );
    expect(required(workflow.jobs["publish"]).needs).toContain("validate");
    expect(required(workflow.jobs["generate"]).needs).toContain("validate");
    const shared = parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../../../../../.github/workflows/repository-validation.yml",
        ),
        "utf8",
      ),
    ) as typeof workflow;
    expect(
      required(shared.jobs["validate"])
        .steps.filter((s) => s.run)
        .map((s) => s.run),
    ).toEqual(
      expect.arrayContaining([
        "pnpm build",
        "pnpm ci:test:integration",
        "pnpm docs:links",
      ]),
    );
  });
});
