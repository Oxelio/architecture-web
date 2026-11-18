import { isDeepStrictEqual } from "node:util";

import { resolveActivationContext } from "../config/activation-context.js";
import { createAuthoringControlVerifier } from "../github/authoring-control-revision.js";
import { verifyControllerInstallation } from "../github/controller-installation.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import {
  matchesStandingControllerBoundary,
  type StandingControllerBoundary,
} from "../github/standing-controller-boundary.js";
import { isStandingDelegationRevoked } from "../github/standing-delegation-revocation.js";
import { verifyStandingJournalRules } from "../github/work-merge-publisher.js";
import {
  positiveInteger,
  readActivationManifest,
  requiredEnvironment,
} from "./gate-publication-support.js";
import {
  githubRepositoryRequest,
  readDirectMaintainerRecord,
  requireTrustedMain,
} from "./work-pilot-support.js";

const repository = "Oxelio/architecture-web";
const repositoryId = 1336937640;
export const protectedProjectId = "PVT_kwHOBPzbjc4Bgts6";

interface SourceEntry {
  readonly name: string;
  readonly sha: string;
}

export function requireProtectedDispatch(workflow: string) {
  requireTrustedMain("workflow_dispatch");
  if (
    process.env["GITHUB_WORKFLOW_REF"] !==
    `${repository}/.github/workflows/${workflow}@refs/heads/main`
  ) {
    throw new Error("PROTECTED_WORKFLOW_UNVERIFIED");
  }
}

export async function readProtectedRuntime(approvedControlRevision: string) {
  const workflowSha = requiredEnvironment("TRUSTED_WORKFLOW_SHA");
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const projectsToken = requiredEnvironment(
    "DELIVERY_OBSERVATION_PROJECTS_TOKEN",
  );
  const mergeToken = requiredEnvironment("CONTROLLER_INSTALLATION_TOKEN");
  const controllerInstallationId = positiveInteger(
    "CONTROLLER_INSTALLATION_ID",
  );
  const boundaryComment = positiveInteger(
    "DELIVERY_STANDING_BOUNDARY_COMMENT_ID",
  );
  const delegationCommentId = positiveInteger(
    "DELIVERY_STANDING_DELEGATION_COMMENT_ID",
  );
  const verifyControl = createAuthoringControlVerifier({
    approvedRevision: approvedControlRevision,
    readToken: repositoryToken,
  });
  if (!(await verifyControl(workflowSha))) {
    return null;
  }
  const [installation, inventory, manifest, root, tooling] = await Promise.all([
    verifyControllerInstallation({
      token: mergeToken,
      appSlug: requiredEnvironment("CONTROLLER_APP_SLUG"),
      expectedAppSlug: "architecture-web-work-controller",
      installationId: controllerInstallationId,
      expectedInstallationId: 182503016,
    }),
    readGitHubInventory({ repository, repositoryToken, projectsToken }),
    readActivationManifest(),
    githubRepositoryRequest<SourceEntry[]>(`/contents?ref=${workflowSha}`),
    githubRepositoryRequest<SourceEntry[]>(
      `/contents/packages/tooling?ref=${workflowSha}`,
    ),
  ]);
  const owner = resolveActivationContext({ repository, inventory, manifest });
  if (
    !installation ||
    owner.status !== "ready" ||
    owner.project.id !== protectedProjectId ||
    !owner.activation.workState ||
    !owner.activation.dependencies ||
    !owner.activation.workIntegrationPr
  ) {
    return null;
  }
  const expected = {
    repositoryId,
    projectId: protectedProjectId,
    controllerInstallationId,
    checksInstallationId: 178883123,
    sources: {
      ".github": root.find(({ name }) => name === ".github")?.sha ?? "",
      "pnpm-lock.yaml":
        root.find(({ name }) => name === "pnpm-lock.yaml")?.sha ?? "",
      "packages/tooling/delivery-automation":
        tooling.find(({ name }) => name === "delivery-automation")?.sha ?? "",
    },
  };
  const readBoundary = () =>
    readDirectMaintainerRecord<StandingControllerBoundary>(
      boundaryComment,
      115,
    );
  const boundary = await readBoundary();
  if (
    !matchesStandingControllerBoundary(boundary, expected, {
      mode: "standing",
      now: Date.now(),
    })
  ) {
    return null;
  }
  const readStandingRulesetObservation = async (id: number) => {
    const observed = (await readBoundary())?.rulesetObservations.filter(
      (item) => item.rulesetId === id,
    );
    return observed?.length === 1 ? (observed[0] ?? null) : null;
  };
  const reader = {
    repository,
    repositoryId,
    repositoryToken,
    readStandingRulesetObservation,
  };
  const verify = async () =>
    isDeepStrictEqual(boundary, await readBoundary()) &&
    (
      await githubRepositoryRequest<{ commit: { sha: string } }>(
        "/branches/main",
      )
    ).commit.sha === workflowSha &&
    !(await isStandingDelegationRevoked({
      repositoryToken,
      delegationCommentId,
    })) &&
    verifyStandingJournalRules(reader, {
      creationRulesetId: boundary.journalCreationRulesetId,
      immutabilityRulesetId: boundary.journalImmutabilityRulesetId,
      controllerAppId: 5781545,
    });
  return {
    workflowSha,
    projectsToken,
    mergeToken,
    manifest,
    verify,
    activation: owner.activation,
    boundary,
    actorId: installation.botId,
    ...reader,
  };
}

export async function readActionsOidcToken(audience: string): Promise<string> {
  const url = new URL(requiredEnvironment("ACTIONS_ID_TOKEN_REQUEST_URL"));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(
      url.hostname === "pipelines.actions.githubusercontent.com" ||
      url.hostname.endsWith(".actions.githubusercontent.com")
    )
  ) {
    throw new Error("ACTIONS_OIDC_ENDPOINT_UNVERIFIED");
  }
  url.searchParams.set("audience", audience);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${requiredEnvironment("ACTIONS_ID_TOKEN_REQUEST_TOKEN")}`,
    },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const body = response.ok
    ? ((await response.json()) as { value?: unknown })
    : null;
  if (
    typeof body?.value !== "string" ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(body.value)
  ) {
    throw new Error("ACTIONS_OIDC_TOKEN_UNVERIFIED");
  }
  return body.value;
}
