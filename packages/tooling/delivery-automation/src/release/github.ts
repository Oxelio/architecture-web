import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import semver from "semver";

import {
  readVerifiedArtifacts,
  type ReleaseManifest,
  sha256,
} from "./artifacts.js";
import { type FirstStableRequest } from "./policy.js";
import { git, readReleasePlan } from "./repository.js";

export type ReleaseFetch = typeof fetch;
interface Release {
  readonly id: number;
  readonly body: string;
  readonly draft: boolean;
}
interface Asset {
  readonly id: number;
  readonly name: string;
}
interface TagRef {
  readonly ref: string;
  readonly object: { readonly type: string; readonly sha: string };
}

export class ReleaseGitHub {
  constructor(
    readonly repository: string,
    private readonly token: string,
    private readonly fetchImpl: ReleaseFetch = fetch,
  ) {
    if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) {
      throw new Error("INVALID_REPOSITORY");
    }
  }

  async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T | null> {
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${this.repository}${path}`,
      {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "x-github-api-version": "2022-11-28",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    if (response.status === 404 && method === "GET") {
      return null;
    }
    if (!response.ok) {
      throw new Error(
        `GitHub ${method} ${path} failed: HTTP ${response.status}`,
      );
    }
    return (await response.json()) as T;
  }

  async tags(): Promise<readonly TagRef[]> {
    const tags = await this.request<readonly TagRef[]>(
      "/git/matching-refs/tags/v",
    );
    if (!tags) {
      throw new Error("RELEASE_TAGS_UNAVAILABLE");
    }
    return tags;
  }

  async tagManifest(tag: TagRef): Promise<ReleaseManifest> {
    if (tag.object.type !== "tag") {
      throw new Error("RELEASE_TAG_METADATA_MISSING");
    }
    const annotation = await this.request<{
      readonly message: string;
      readonly object: { readonly sha: string; readonly type: string };
    }>(`/git/tags/${tag.object.sha}`);
    if (!annotation || annotation.object.type !== "commit") {
      throw new Error("INVALID_RELEASE_TAG_TARGET");
    }
    const manifest = JSON.parse(annotation.message) as ReleaseManifest;
    if (
      manifest.plan.sourceSha !== annotation.object.sha ||
      tag.ref !== `refs/tags/${manifest.plan.tag}`
    ) {
      throw new Error("RELEASE_TAG_IDENTITY_MISMATCH");
    }
    return manifest;
  }

  async verifyFirstStable(request: FirstStableRequest): Promise<void> {
    const run = await this.request<{
      readonly event: string;
      readonly head_sha: string;
      readonly actor: { readonly login: string; readonly type: string };
      readonly path: string;
    }>(`/actions/runs/${request.runId}`);
    const permission = await this.request<{
      readonly role_name: string;
      readonly user: { readonly type: string };
    }>(`/collaborators/${encodeURIComponent(request.actor)}/permission`);
    if (
      !run ||
      run.event !== "workflow_dispatch" ||
      run.head_sha !== request.sourceSha ||
      run.actor.login !== request.actor ||
      run.actor.type !== "User" ||
      run.path !== ".github/workflows/release.yml" ||
      !permission ||
      permission.user.type !== "User" ||
      !["maintain", "admin"].includes(permission.role_name)
    ) {
      throw new Error("FIRST_STABLE_REQUIRES_HUMAN_MAINTAINER_DISPATCH");
    }
  }

  async assets(releaseId: number): Promise<readonly Asset[]> {
    const assets = await this.request<readonly Asset[]>(
      `/releases/${releaseId}/assets?per_page=100`,
    );
    if (
      !assets ||
      assets.length >= 100 ||
      new Set(assets.map((a) => a.name)).size !== assets.length
    ) {
      throw new Error("INVALID_REMOTE_ASSETS");
    }
    return assets;
  }

  async download(assetId: number): Promise<Uint8Array> {
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${this.repository}/releases/assets/${assetId}`,
      {
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: "application/octet-stream",
        },
      },
    );
    if (!response.ok) {
      throw new Error("RELEASE_ASSET_DOWNLOAD_FAILED");
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async upload(
    releaseId: number,
    name: string,
    data: Uint8Array,
  ): Promise<void> {
    const response = await this.fetchImpl(
      `https://uploads.github.com/repos/${this.repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/octet-stream",
        },
        body: new Blob([new Uint8Array(data)]),
      },
    );
    if (!response.ok) {
      throw new Error(
        `RELEASE_ASSET_UPLOAD_FAILED: ${name} HTTP ${response.status}`,
      );
    }
  }
}

export async function pendingRelease(
  client: ReleaseGitHub,
): Promise<ReleaseManifest | null> {
  const tags = [...(await client.tags())].sort((a, b) => {
    const av = a.ref.slice("refs/tags/v".length),
      bv = b.ref.slice("refs/tags/v".length);
    if (semver.valid(av) !== av || semver.valid(bv) !== bv) {
      throw new Error("INVALID_RELEASE_TAG");
    }
    return semver.rcompare(av, bv);
  });
  const latest = tags[0];
  if (!latest) {
    return null;
  }
  const tag = latest.ref.slice("refs/tags/".length);
  const release = await client.request<Release>(
    `/releases/tags/${encodeURIComponent(tag)}`,
  );
  return !release || release.draft ? client.tagManifest(latest) : null;
}

export async function publishRelease(
  root: string,
  directory: string,
  client: ReleaseGitHub,
): Promise<void> {
  const manifest = readVerifiedArtifacts(directory);
  const { plan } = manifest;
  if (!plan.version || !plan.tag) {
    throw new Error("INVALID_PUBLICATION_PLAN");
  }
  git(root, "merge-base", "--is-ancestor", plan.sourceSha, "origin/main");
  if (plan.firstStable) {
    await client.verifyFirstStable(plan.firstStable);
  }
  const tags = await client.tags();
  for (const tag of tags) {
    const version = tag.ref.slice("refs/tags/v".length);
    if (semver.valid(version) !== version || semver.prerelease(version)) {
      throw new Error("UNSUPPORTED_REMOTE_RELEASE_TAG");
    }
    if (semver.gt(version, plan.version)) {
      throw new Error("OBSOLETE_RELEASE_CANDIDATE");
    }
  }
  const existingTag = tags.find((tag) => tag.ref === `refs/tags/${plan.tag}`);
  if (
    existingTag &&
    JSON.stringify(await client.tagManifest(existingTag)) !==
      JSON.stringify(manifest)
  ) {
    throw new Error("RELEASE_TAG_CONFLICT");
  }
  const recalculated = await readReleasePlan(
    root,
    plan.sourceSha,
    plan.firstStable,
    existingTag ? plan.tag : null,
  );
  if (JSON.stringify(recalculated) !== JSON.stringify(plan)) {
    throw new Error("RELEASE_PLAN_CHANGED");
  }
  let release = await client.request<Release>(
    `/releases/tags/${encodeURIComponent(plan.tag)}`,
  );
  const marker = `<!-- architecture-web:release-manifest:sha256:${sha256(join(directory, "release-manifest.json"))} -->`;
  if (release && !release.body.includes(marker)) {
    throw new Error("RELEASE_METADATA_CONFLICT");
  }
  const names = [
    ...Object.keys(manifest.files),
    "release-manifest.json",
    "SHA256SUMS",
  ].sort();
  const existingAssets = release ? await client.assets(release.id) : [];
  for (const asset of existingAssets) {
    if (
      !names.includes(asset.name) ||
      createHash("sha256")
        .update(await client.download(asset.id))
        .digest("hex") !== sha256(join(directory, asset.name))
    ) {
      throw new Error("REMOTE_RELEASE_ASSET_CONFLICT");
    }
  }
  if (!existingTag) {
    const tag = await client.request<{ readonly sha: string }>(
      "/git/tags",
      "POST",
      {
        tag: plan.tag,
        message: JSON.stringify(manifest),
        object: plan.sourceSha,
        type: "commit",
      },
    );
    if (!tag) {
      throw new Error("TAG_CREATION_FAILED");
    }
    await client.request("/git/refs", "POST", {
      ref: `refs/tags/${plan.tag}`,
      sha: tag.sha,
    });
  }
  if (!release) {
    release = await client.request<Release>("/releases", "POST", {
      tag_name: plan.tag,
      target_commitish: plan.sourceSha,
      name: plan.tag,
      body: `${readFileSync(join(directory, "release-notes.md"), "utf8")}\n${marker}`,
      draft: true,
      prerelease: false,
    });
  }
  if (!release) {
    throw new Error("RELEASE_CREATION_FAILED");
  }
  for (const name of names) {
    if (!existingAssets.some((asset) => asset.name === name)) {
      await client.upload(
        release.id,
        name,
        readFileSync(join(directory, name)),
      );
    }
  }
  if (release.draft) {
    await client.request(`/releases/${release.id}`, "PATCH", { draft: false });
  }
}
