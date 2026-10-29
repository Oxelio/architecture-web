import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateArtifacts } from "../release/artifacts.js";
import {
  pendingRelease,
  publishRelease,
  ReleaseGitHub,
} from "../release/github.js";
import {
  assertPublicationContext,
  type FirstStableRequest,
} from "../release/policy.js";
import {
  git,
  readReleasePlan,
  type ReleasePlan,
} from "../release/repository.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "plan";
  const root = git(process.cwd(), "rev-parse", "--show-toplevel");
  process.chdir(root);
  const output = resolve(process.argv[3] ?? "release-output");
  const env = process.env;
  if (command === "generate") {
    const plan = JSON.parse(
      readFileSync(process.argv[4] ?? "release-plan.json", "utf8"),
    ) as ReleasePlan;
    await generateArtifacts(root, plan, output);
    return;
  }
  if (command === "publish") {
    assertPublicationContext({
      ref: env["GITHUB_REF"] ?? "",
      event: env["GITHUB_EVENT_NAME"] ?? "",
    });
    const client = new ReleaseGitHub(
      required("GITHUB_REPOSITORY"),
      required("GITHUB_TOKEN"),
    );
    await publishRelease(root, output, client);
    return;
  }
  if (command !== "plan" && command !== "ci-plan") {
    throw new Error("UNKNOWN_RELEASE_COMMAND");
  }
  let request: FirstStableRequest | null = null;
  let sourceSha = git(root, "rev-parse", "HEAD");
  let resumeTag: string | null = null;
  if (command === "ci-plan") {
    assertPublicationContext({
      ref: required("GITHUB_REF"),
      event: required("GITHUB_EVENT_NAME"),
    });
    const client = new ReleaseGitHub(
      required("GITHUB_REPOSITORY"),
      required("GITHUB_TOKEN"),
    );
    const pending = await pendingRelease(client);
    if (pending) {
      sourceSha = pending.plan.sourceSha;
      resumeTag = pending.plan.tag;
      request = pending.plan.firstStable;
    } else if (env["RELEASE_LEVEL"] === "first-stable") {
      if (env["GITHUB_EVENT_NAME"] !== "workflow_dispatch") {
        throw new Error("FIRST_STABLE_REQUIRES_DISPATCH");
      }
      sourceSha = required("EXPECTED_SHA");
      if (sourceSha !== required("GITHUB_SHA")) {
        throw new Error("FIRST_STABLE_SHA_MISMATCH");
      }
      request = {
        sourceSha,
        actor: required("GITHUB_ACTOR"),
        runId: required("GITHUB_RUN_ID"),
      };
    } else {
      sourceSha = git(root, "rev-parse", "origin/main");
    }
    git(root, "merge-base", "--is-ancestor", sourceSha, "origin/main");
    if (request) {
      await client.verifyFirstStable(request);
    }
  }
  const plan = await readReleasePlan(root, sourceSha, request, resumeTag);
  if (command === "ci-plan") {
    writeFileSync("release-plan.json", `${JSON.stringify(plan, null, 2)}\n`);
    appendFileSync(
      required("GITHUB_OUTPUT"),
      `version=${plan.version ?? ""}\nsource_sha=${sourceSha}\n`,
    );
  }
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
