import type { DeliveryActivationManifest } from "../config/activation-manifest.js";
import type { WorkState } from "../control/eligibility.js";
import { architectureWebDeliveryExpectations } from "../inventory/delivery-expectations.js";
import type { OperationalOwnerActivation } from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";
import {
  type AuthorizedWorkIntegrationTarget,
  readAuthorizedWorkIntegrationTarget,
} from "./work-integration-target.js";

const validWorkStates = new Set<WorkState>([
  "Idea",
  "Exploring",
  "Designing",
  "Awaiting Approval",
  "Preparing",
  "Ready",
  "Implementing",
  "Reviewing",
  "Validating",
  "Done",
]);

interface DependencyIssue {
  readonly state: "open" | "closed";
}

interface PullRequestMergeability {
  readonly number: number;
  readonly state: "open" | "closed";
  readonly draft: boolean;
  readonly mergeable: boolean | null;
  readonly head: { readonly sha: string };
  readonly base: { readonly ref: string; readonly sha: string };
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
  };
}

function parseWorkState(value: string | undefined): WorkState | null {
  return value && validWorkStates.has(value as WorkState)
    ? (value as WorkState)
    : null;
}

interface WorkItemInput {
  readonly repository: string;
  readonly projectId: string;
  readonly projectsToken: string;
  readonly workNumber: number;
  readonly fetchImpl: FetchLike;
}

interface GateWorkItem {
  readonly status?: { readonly name?: string } | null;
  readonly workType?: { readonly name?: string } | null;
  readonly workflowDepth?: { readonly name?: string } | null;
}

interface GateWorkLabels {
  readonly nodes: readonly ({ readonly name?: string } | null)[];
  readonly pageInfo: { readonly hasNextPage: boolean };
}

async function readGateWorkItem(
  input: WorkItemInput,
  classification = false,
): Promise<{
  readonly item: GateWorkItem;
  readonly labels: GateWorkLabels | null;
} | null> {
  const [owner, name] = input.repository.split("/");
  const response = await input.fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      ...headers(input.projectsToken),
      "content-type": "application/json",
    },
    redirect: "error",
    body: JSON.stringify({
      query: `query ArchitectureWebGateWorkItem($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          nameWithOwner
          issue(number: $number) {
            number state parent { id }
            ${classification ? "labels(first: 100) { nodes { name } pageInfo { hasNextPage } }" : ""}
            projectItems(first: 100, includeArchived: false) {
              nodes {
                project { id closed }
                status: fieldValueByName(name: "Status") {
                  ... on ProjectV2ItemFieldSingleSelectValue { name }
                }
                ${
                  classification
                    ? `
                  workType: fieldValueByName(name: "Work Type") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
                  workflowDepth: fieldValueByName(name: "Workflow Depth") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
                `
                    : ""
                }
              }
              pageInfo { hasNextPage }
            }
          }
        }
      }`,
      variables: { owner, name, number: input.workNumber },
    }),
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    readonly errors?: readonly unknown[];
    readonly data?: {
      readonly repository?: {
        readonly nameWithOwner: string;
        readonly issue?: {
          readonly number: number;
          readonly state: string;
          readonly parent: object | null;
          readonly labels?: GateWorkLabels | null;
          readonly projectItems: {
            readonly nodes: readonly (
              | (GateWorkItem & {
                  readonly project: {
                    readonly id: string;
                    readonly closed: boolean;
                  };
                })
              | null
            )[];
            readonly pageInfo: { readonly hasNextPage: boolean };
          };
        } | null;
      } | null;
    };
  };
  const repository = payload.data?.repository;
  const issue = repository?.issue;
  if (
    payload.errors?.length ||
    repository?.nameWithOwner.toLowerCase() !==
      input.repository.toLowerCase() ||
    issue?.number !== input.workNumber ||
    issue.state !== "OPEN" ||
    issue.parent !== null ||
    issue.projectItems.pageInfo.hasNextPage !== false
  ) {
    return null;
  }
  const items = issue.projectItems.nodes.filter(
    (item) =>
      item?.project.id === input.projectId && item.project.closed === false,
  );
  const item = items.length === 1 ? items[0] : null;
  return item ? { item, labels: issue.labels ?? null } : null;
}

const standingWorkTypes = [
  "Technical Change",
  "Defect Correction",
  "Documentation-only Change",
] as const;
type StandingWorkType = (typeof standingWorkTypes)[number];
type StandingDepth = "Quick" | "Standard" | "Complex";

export interface StandingWorkClassification {
  readonly workType: StandingWorkType;
  readonly workflowDepth: StandingDepth;
  readonly characteristics: readonly string[];
}

export async function readStandingWorkClassification(
  input: WorkItemInput & { readonly manifest: DeliveryActivationManifest },
): Promise<StandingWorkClassification | null> {
  const { project, mappings } = input.manifest;
  if (
    input.repository.toLowerCase() !== "oxelio/architecture-web" ||
    project?.owner !== "Oxelio" ||
    project.number !== 3 ||
    mappings.workState.status !== "verified" ||
    mappings.workType.status !== "verified" ||
    mappings.workflowDepth.status !== "verified" ||
    mappings.characteristics.status !== "verified"
  ) {
    return null;
  }

  const work = await readGateWorkItem(input, true);
  if (
    work?.item.status?.name !== "Validating" ||
    work.labels?.pageInfo.hasNextPage !== false ||
    !Array.isArray(work.labels.nodes)
  ) {
    return null;
  }
  const workType = standingWorkTypes.find(
    (kind) => kind === work.item.workType?.name,
  );
  const workflowDepth = work.item.workflowDepth?.name;
  if (
    !workType ||
    (workflowDepth !== "Quick" &&
      workflowDepth !== "Standard" &&
      workflowDepth !== "Complex")
  ) {
    return null;
  }

  const characteristics = new Set<string>();
  for (const label of work.labels.nodes) {
    const name = label?.name;
    if (typeof name !== "string" || !name) {
      return null;
    }
    if (name.startsWith("char:")) {
      if (
        !architectureWebDeliveryExpectations.labels.includes(name) ||
        characteristics.has(name)
      ) {
        return null;
      }
      characteristics.add(name);
    }
  }
  return {
    workType,
    workflowDepth,
    characteristics: [...characteristics].sort(),
  };
}

async function readDependencyResolution(input: {
  readonly repository: string;
  readonly workNumber: number;
  readonly repositoryToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<boolean | null> {
  for (let page = 1; page <= 20; page += 1) {
    const response = await input.fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.workNumber}/dependencies/blocked_by?per_page=100&page=${page}`,
      { headers: headers(input.repositoryToken) },
    );
    if (!response.ok) {
      return null;
    }

    const dependencies = (await response.json()) as readonly DependencyIssue[];
    if (dependencies.some((dependency) => dependency.state === "open")) {
      return false;
    }
    if (dependencies.length < 100) {
      return true;
    }
  }

  return null;
}

async function readPullRequestMergeability(input: {
  readonly repository: string;
  readonly target: AuthorizedWorkIntegrationTarget;
  readonly repositoryToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<{ readonly mergeable: boolean; readonly baseSha: string } | null> {
  const response = await input.fetchImpl(
    `https://api.github.com/repos/${input.repository}/pulls/${input.target.pullRequestNumber}`,
    { headers: headers(input.repositoryToken) },
  );
  if (!response.ok) {
    return null;
  }

  const pullRequest = (await response.json()) as PullRequestMergeability;
  if (
    pullRequest.number !== input.target.pullRequestNumber ||
    pullRequest.state !== "open" ||
    pullRequest.head.sha !== input.target.headSha ||
    pullRequest.base.ref !== input.target.baseRef ||
    !/^[0-9a-f]{40}$/u.test(pullRequest.base.sha) ||
    typeof pullRequest.draft !== "boolean" ||
    (!pullRequest.draft && typeof pullRequest.mergeable !== "boolean")
  ) {
    return null;
  }
  return {
    mergeable: !pullRequest.draft && pullRequest.mergeable === true,
    baseSha: pullRequest.base.sha,
  };
}

export type WorkMergeGateLiveEvidenceResolution =
  | {
      readonly status: "ready";
      readonly workState: WorkState;
      readonly dependenciesResolved: boolean;
      readonly pullRequestMergeable: boolean;
      readonly baseSha: string;
      readonly target: AuthorizedWorkIntegrationTarget;
    }
  | {
      readonly status: "blocked";
      readonly reason:
        | "WORK_STATE_OWNER_INACTIVE"
        | "DEPENDENCY_OWNER_INACTIVE"
        | "WORK_INTEGRATION_PR_OWNER_INACTIVE"
        | "WORK_INTEGRATION_PR_AMBIGUOUS"
        | "WORK_INTEGRATION_PR_UNAVAILABLE"
        | "WORK_ITEM_UNAVAILABLE"
        | "WORK_STATE_UNAVAILABLE"
        | "DEPENDENCY_STATE_UNAVAILABLE"
        | "PR_MERGEABILITY_UNAVAILABLE";
    };

export async function readWorkMergeGateLiveEvidence(input: {
  readonly repository: string;
  readonly projectId: string;
  readonly projectsToken: string;
  readonly repositoryToken: string;
  readonly workNumber: number;
  readonly activation: OperationalOwnerActivation;
  readonly fetchImpl?: FetchLike;
}): Promise<WorkMergeGateLiveEvidenceResolution> {
  if (!input.activation.workState) {
    return { status: "blocked", reason: "WORK_STATE_OWNER_INACTIVE" };
  }
  if (!input.activation.dependencies) {
    return { status: "blocked", reason: "DEPENDENCY_OWNER_INACTIVE" };
  }
  if (!input.activation.workIntegrationPr) {
    return {
      status: "blocked",
      reason: "WORK_INTEGRATION_PR_OWNER_INACTIVE",
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const [work, target, dependenciesResolved] = await Promise.all([
    readGateWorkItem({
      repository: input.repository,
      projectId: input.projectId,
      projectsToken: input.projectsToken,
      workNumber: input.workNumber,
      fetchImpl,
    }),
    readAuthorizedWorkIntegrationTarget({
      repository: input.repository,
      workNumber: input.workNumber,
      repositoryToken: input.repositoryToken,
      active: true,
      fetchImpl,
    }),
    readDependencyResolution({
      repository: input.repository,
      workNumber: input.workNumber,
      repositoryToken: input.repositoryToken,
      fetchImpl,
    }),
  ]);

  if (target.status !== "selected") {
    return {
      status: "blocked",
      reason:
        target.status === "ambiguous"
          ? "WORK_INTEGRATION_PR_AMBIGUOUS"
          : "WORK_INTEGRATION_PR_UNAVAILABLE",
    };
  }

  if (!work) {
    return { status: "blocked", reason: "WORK_ITEM_UNAVAILABLE" };
  }

  const workState = parseWorkState(work.item.status?.name);
  if (!workState) {
    return { status: "blocked", reason: "WORK_STATE_UNAVAILABLE" };
  }
  if (dependenciesResolved === null) {
    return { status: "blocked", reason: "DEPENDENCY_STATE_UNAVAILABLE" };
  }

  const pullRequestMergeable = await readPullRequestMergeability({
    repository: input.repository,
    target: target.target,
    repositoryToken: input.repositoryToken,
    fetchImpl,
  });
  if (pullRequestMergeable === null) {
    return { status: "blocked", reason: "PR_MERGEABILITY_UNAVAILABLE" };
  }

  return {
    status: "ready",
    workState,
    dependenciesResolved,
    pullRequestMergeable: pullRequestMergeable.mergeable,
    baseSha: pullRequestMergeable.baseSha,
    target: target.target,
  };
}
