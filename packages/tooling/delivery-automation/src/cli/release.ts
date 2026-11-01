import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

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
  confinedReleasePath,
  prepareReleaseOutput,
  verifiedReleaseInput,
} from "../release/release-paths.js";
import {
  git,
  readReleasePlan,
  type ReleasePlan,
} from "../release/repository.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "plan";
  const root = git(process.cwd(), "rev-parse", "--show-toplevel");
  process.chdir(root);
  const output = process.argv[3] ?? "release-output";
  const env = process.env;
  if (command === "generate") {
    const directory = confinedReleasePath(root, output);
    const plan = JSON.parse(
      readFileSync(
        confinedReleasePath(root, process.argv[4] ?? "release-plan.json"),
        "utf8",
      ),
    ) as ReleasePlan;
    await generateArtifacts(
      root,
      plan,
      prepareReleaseOutput(root, directory, plan.version),
    );
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
    await publishRelease(root, verifiedReleaseInput(root, output), client);
    return;
  }
  if (command !== "plan" && command !== "ci-plan") {
    throw new Error("UNKNOWN_RELEASE_COMMAND");
  }
  const { request, sourceSha, resumeTag } =
    command === "ci-plan"
      ? await ciPlanningContext(root)
      : {
          request: null,
          sourceSha: git(root, "rev-parse", "HEAD"),
          resumeTag: null,
        };
  const plan = await readReleasePlan(root, sourceSha, request, resumeTag);
  if (command === "ci-plan") {
    writeFileSync(
      confinedReleasePath(root, "release-plan.json"),
      `${JSON.stringify(plan, null, 2)}\n`,
    );
    appendFileSync(
      required("GITHUB_OUTPUT"),
      `version=${plan.version ?? ""}\nsource_sha=${sourceSha}\n`,
    );
  }
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

async function ciPlanningContext(root: string): Promise<{
  request: FirstStableRequest | null;
  sourceSha: string;
  resumeTag: string | null;
}> {
  const env = process.env;
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
    const { sourceSha, tag: resumeTag, firstStable: request } = pending.plan;
    git(root, "merge-base", "--is-ancestor", sourceSha, "origin/main");
    if (request) {
      await client.verifyFirstStable(request);
    }
    return { sourceSha, resumeTag, request };
  }
  let request: FirstStableRequest | null = null;
  let sourceSha: string;
  if (env["RELEASE_LEVEL"] === "first-stable") {
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
  return { request, sourceSha, resumeTag: null };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

try {
  await main();
} catch (error: unknown) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
