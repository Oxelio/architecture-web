import { operationalOwnerActivation } from "../config/activation-manifest.js";
import {
  observeWorkMerge,
  type WorkMergeGrant,
} from "../github/work-merge-publisher.js";
import {
  positiveInteger,
  readActivationManifest,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";

async function main(): Promise<void> {
  if (
    process.env["GITHUB_EVENT_NAME"] !== "workflow_dispatch" ||
    process.env["GITHUB_REF"] !== "refs/heads/main" ||
    process.env["GITHUB_RUN_ATTEMPT"] !== "1" ||
    !process.env["GITHUB_SHA"] ||
    process.env["GITHUB_SHA"] !== process.env["TRUSTED_WORKFLOW_SHA"]
  ) {
    throw new Error(
      "A fresh dispatch on the trusted main revision is required",
    );
  }

  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const actorId = positiveInteger("GITHUB_ACTOR_ID");
  const repositoryId = positiveInteger("GITHUB_REPOSITORY_ID");
  const candidate = {
    workNumber: positiveInteger("WORK_NUMBER"),
    pullNumber: positiveInteger("PULL_NUMBER"),
    headSha: requiredEnvironment("HEAD_SHA"),
    baseSha: requiredEnvironment("BASE_SHA"),
  };
  const mode = requiredEnvironment("MERGE_MODE");
  if (mode !== "direct" && mode !== "auto") {
    throw new Error("MERGE_MODE must be direct or auto");
  }

  const grant = JSON.parse(
    requiredEnvironment("DELIVERY_OBSERVATION_GRANT"),
  ) as WorkMergeGrant | null;
  if (
    !grant ||
    grant.actorId !== actorId ||
    grant.repositoryId !== repositoryId ||
    grant.workNumber !== candidate.workNumber ||
    grant.pullNumber !== candidate.pullNumber ||
    grant[mode] !== true
  ) {
    throw new Error("No matching observation grant");
  }
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const projectsToken = requiredEnvironment(
    "DELIVERY_OBSERVATION_PROJECTS_TOKEN",
  );
  const manifest = await readActivationManifest();
  const locator = manifest.project;
  if (
    !locator ||
    process.env["GITHUB_ACTOR"]?.toLowerCase() !==
      locator.owner.toLowerCase() ||
    repository.split("/")[0]?.toLowerCase() !== locator.owner.toLowerCase()
  ) {
    throw new Error(
      "Observation requires the authenticated Project maintainer",
    );
  }
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${projectsToken}`,
      "content-type": "application/json",
    },
    redirect: "error",
    body: JSON.stringify({
      query: `query ArchitectureWebObservationOwner($owner: String!, $number: Int!) {
        user(login: $owner) { databaseId projectV2(number: $number) { id number closed } }
      }`,
      variables: locator,
    }),
  });
  const payload = (await response.json()) as {
    readonly errors?: readonly unknown[];
    readonly data?: {
      readonly user?: {
        readonly databaseId: number;
        readonly projectV2?: {
          readonly id: string;
          readonly number: number;
          readonly closed: boolean;
        } | null;
      } | null;
    };
  };
  const user = payload.data?.user;
  const project = user?.projectV2;
  if (
    !response.ok ||
    payload.errors?.length ||
    user?.databaseId !== actorId ||
    project?.number !== locator.number ||
    project.closed !== false ||
    !project.id
  ) {
    throw new Error("Project operational owner unavailable");
  }

  const result = await observeWorkMerge(
    {
      repository,
      repositoryId,
      actorId,
      repositoryToken,
      projectsToken,
      projectId: project.id,
      activation: operationalOwnerActivation(manifest),
      readGrant: async () => grant,
    },
    candidate,
    mode,
  );
  writeJson({
    actorId,
    repositoryId,
    candidate,
    mode,
    observation: true,
    result,
  });
  if (result.status !== "observed-checks-passed") {
    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error: unknown) {
  const message =
    error instanceof SyntaxError
      ? "Observation grant is invalid JSON"
      : error instanceof Error
        ? error.message
        : "Observation failed";
  process.stderr.write(`Work integration observation failed: ${message}\n`);
  process.exitCode = 1;
}
