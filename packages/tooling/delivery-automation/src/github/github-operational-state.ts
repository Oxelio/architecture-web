import type {
  ClaimState,
  DependencyState,
  Priority,
  RouteState,
  TargetRefState,
  TaskDispatchCandidate,
  TaskParentState,
  WipState,
  WorkPullCandidate,
  WorkState,
} from "../control/eligibility.js";
import { parseTaskClaim } from "../control/task-claim.js";
import type { FetchLike } from "./github-project-inventory.js";

export interface OperationalOwnerActivation {
  readonly workState: boolean;
  readonly priority: boolean;
  readonly routes: boolean;
  readonly dependencies: boolean;
  readonly taskParent: boolean;
  readonly taskClaim: boolean;
  readonly workIntegrationPr: boolean;
}

export interface ProjectWorkItemSnapshot {
  readonly projectItemId: string;
  readonly issueNumber: number;
  readonly issueOpen: boolean;
  readonly labels: readonly string[];
  readonly fields: Readonly<Record<string, string>>;
}

export interface WorkIntegrationPrSnapshot {
  readonly number: number;
  readonly headRef: string;
  readonly baseRef: string;
}

export type WorkIntegrationPrResolution =
  | {
      readonly status: "selected";
      readonly pullRequest: WorkIntegrationPrSnapshot;
    }
  | { readonly status: "unavailable" }
  | {
      readonly status: "ambiguous";
      readonly candidates: readonly WorkIntegrationPrSnapshot[];
    };

interface ProjectFieldValueNode {
  readonly __typename: string;
  readonly name?: string | null;
  readonly text?: string | null;
  readonly number?: number | null;
  readonly field?: { readonly name?: string | null } | null;
}

interface ProjectItemNode {
  readonly id: string;
  readonly isArchived: boolean;
  readonly content?: {
    readonly __typename: string;
    readonly number?: number;
    readonly state?: string;
    readonly repository?: { readonly nameWithOwner: string } | null;
    readonly parent?: {
      readonly number: number;
      readonly repository?: { readonly nameWithOwner: string } | null;
    } | null;
    readonly labels?: {
      readonly nodes: readonly { readonly name: string }[];
      readonly pageInfo: { readonly hasNextPage: boolean };
    };
  } | null;
  readonly fieldValues: {
    readonly nodes: readonly ProjectFieldValueNode[];
    readonly pageInfo: { readonly hasNextPage: boolean };
  };
}

interface ProjectItemsQueryResponse {
  readonly data?: {
    readonly node?: {
      readonly __typename: string;
      readonly items?: {
        readonly nodes: readonly ProjectItemNode[];
        readonly pageInfo: {
          readonly hasNextPage: boolean;
          readonly endCursor: string | null;
        };
      };
    } | null;
  };
  readonly errors?: readonly { readonly message: string }[];
}

interface RestIssueSnapshot {
  readonly number: number;
  readonly state: "open" | "closed";
  readonly labels: readonly ({ readonly name?: string } | string)[];
}

interface TimelineEvent {
  readonly event: string;
  readonly source?: {
    readonly issue?: RestIssueSnapshot & {
      readonly pull_request?: object;
    };
  };
}

interface PullRequestSnapshot {
  readonly number: number;
  readonly state: "open" | "closed";
  readonly base: { readonly ref: string };
  readonly head: {
    readonly ref: string;
    readonly repo?: { readonly full_name: string } | null;
  };
}

const projectItemsQuery = `
  query ArchitectureWebOperationalItems($projectId: ID!, $after: String) {
    node(id: $projectId) {
      __typename
      ... on ProjectV2 {
        items(first: 100, after: $after) {
          nodes {
            id
            isArchived
            content {
              __typename
              ... on Issue {
                number
                state
                repository { nameWithOwner }
                parent {
                  number
                  repository { nameWithOwner }
                }
                labels(first: 100) {
                  nodes { name }
                  pageInfo { hasNextPage }
                }
              }
            }
            fieldValues(first: 100) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2Field { name }
                    ... on ProjectV2SingleSelectField { name }
                  }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2Field { name }
                    ... on ProjectV2SingleSelectField { name }
                  }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field {
                    ... on ProjectV2Field { name }
                    ... on ProjectV2SingleSelectField { name }
                  }
                }
              }
              pageInfo { hasNextPage }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

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

const validPriorities = new Set<Priority>([
  "P0 — Critical",
  "P1 — High",
  "P2 — Normal",
  "P3 — Low",
]);

function normalizeRepository(repository: string): string {
  return repository.trim().toLowerCase();
}

function repositoryParts(repository: string): { owner: string; name: string } {
  const [owner, name, ...rest] = repository.split("/");
  if (!owner || !name || rest.length > 0) {
    throw new Error(
      `Invalid GitHub repository '${repository}', expected owner/name`,
    );
  }
  return { owner, name };
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
  };
}

function fieldValue(node: ProjectFieldValueNode): string | null {
  if (typeof node.name === "string") {
    return node.name;
  }
  if (typeof node.text === "string") {
    return node.text;
  }
  if (typeof node.number === "number") {
    return String(node.number);
  }
  return null;
}

function toWorkItem(
  node: ProjectItemNode,
  repository: string,
): ProjectWorkItemSnapshot | null {
  const content = node.content;
  if (
    node.isArchived ||
    content?.__typename !== "Issue" ||
    typeof content.number !== "number" ||
    !content.state ||
    !content.repository ||
    content.parent ||
    normalizeRepository(content.repository.nameWithOwner) !==
      normalizeRepository(repository)
  ) {
    return null;
  }

  if (content.labels?.pageInfo.hasNextPage) {
    throw new Error(
      `Issue #${content.number} has more than 100 labels; refusing truncated route state`,
    );
  }
  if (node.fieldValues.pageInfo.hasNextPage) {
    throw new Error(
      `Project item for issue #${content.number} has more than 100 field values; refusing truncated owner state`,
    );
  }

  const fields: Record<string, string> = {};
  for (const valueNode of node.fieldValues.nodes) {
    const name = valueNode.field?.name;
    const value = fieldValue(valueNode);
    if (!name || value === null) {
      continue;
    }
    if (Object.hasOwn(fields, name)) {
      throw new Error(
        `Project item for issue #${content.number} contains duplicate field value '${name}'`,
      );
    }
    fields[name] = value;
  }

  return {
    projectItemId: node.id,
    issueNumber: content.number,
    issueOpen: content.state === "OPEN",
    labels: (content.labels?.nodes ?? [])
      .map((label) => label.name)
      .toSorted((a, b) => {
        if (a === b) {
          return 0;
        }
        return a < b ? -1 : 1;
      }),
    fields,
  };
}

export async function readProjectWorkItems(input: {
  readonly repository: string;
  readonly projectId: string;
  readonly projectsToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<readonly ProjectWorkItemSnapshot[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const items: ProjectWorkItemSnapshot[] = [];
  let after: string | null = null;

  do {
    const connection = await readProjectItemsPage(
      input.projectId,
      input.projectsToken,
      after,
      fetchImpl,
    );

    for (const itemNode of connection.nodes) {
      const item = toWorkItem(itemNode, input.repository);
      if (item) {
        items.push(item);
      }
    }

    after = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
    if (connection.pageInfo.hasNextPage && !after) {
      throw new Error(
        "GitHub Project item pagination reported another page without a cursor",
      );
    }
  } while (after);

  const duplicateIssue = items.find(
    (item, index) =>
      items.findIndex(
        (candidate) => candidate.issueNumber === item.issueNumber,
      ) !== index,
  );
  if (duplicateIssue) {
    throw new Error(
      `Issue #${duplicateIssue.issueNumber} appears more than once in the selected Project`,
    );
  }

  return items.toSorted((left, right) => left.issueNumber - right.issueNumber);
}

function parseWorkState(value: string | undefined): WorkState | null {
  return value && validWorkStates.has(value as WorkState)
    ? (value as WorkState)
    : null;
}

function parsePriority(value: string | undefined): Priority | null {
  return value && validPriorities.has(value as Priority)
    ? (value as Priority)
    : null;
}

async function readDependencyState(input: {
  readonly repository: string;
  readonly issueNumber: number;
  readonly token: string;
  readonly fetchImpl: FetchLike;
  readonly active: boolean;
}): Promise<DependencyState> {
  if (!input.active) {
    return "unavailable";
  }

  for (let page = 1; page <= 20; page += 1) {
    const response = await input.fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.issueNumber}/dependencies/blocked_by?per_page=100&page=${page}`,
      { headers: headers(input.token) },
    );
    if (!response.ok) {
      return "unavailable";
    }

    const dependencies =
      (await response.json()) as readonly RestIssueSnapshot[];
    if (dependencies.some((dependency) => dependency.state === "open")) {
      return "blocked";
    }
    if (dependencies.length < 100) {
      return "resolved";
    }
  }

  return "unavailable";
}

function deriveWipState(input: {
  readonly candidateNumber: number;
  readonly items: readonly ProjectWorkItemSnapshot[];
  readonly workStateActive: boolean;
}): WipState {
  if (!input.workStateActive) {
    return "unavailable";
  }

  for (const item of input.items) {
    if (!item.issueOpen || item.issueNumber === input.candidateNumber) {
      continue;
    }
    const state = parseWorkState(item.fields["Status"]);
    if (!state) {
      return "unavailable";
    }
    if (state === "Implementing") {
      return "blocked";
    }
  }

  return "available";
}

function routeState(
  item: { readonly labels: readonly string[] },
  active: boolean,
): RouteState {
  return { mappingActive: active, labels: item.labels };
}

export async function readWorkPullCandidates(input: {
  readonly repository: string;
  readonly projectId: string;
  readonly projectsToken: string;
  readonly repositoryToken: string;
  readonly activation: OperationalOwnerActivation;
  readonly fetchImpl?: FetchLike;
}): Promise<readonly WorkPullCandidate[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const items = await readProjectWorkItems({
    repository: input.repository,
    projectId: input.projectId,
    projectsToken: input.projectsToken,
    fetchImpl,
  });

  return Promise.all(
    items.map(async (item): Promise<WorkPullCandidate> => {
      const workState = input.activation.workState
        ? parseWorkState(item.fields["Status"])
        : null;
      const priority = input.activation.priority
        ? parsePriority(item.fields["Priority"])
        : null;

      return {
        workNumber: item.issueNumber,
        workOpen: item.issueOpen,
        workStateAvailable: input.activation.workState && workState !== null,
        workState,
        dependencyState: await readDependencyState({
          repository: input.repository,
          issueNumber: item.issueNumber,
          token: input.repositoryToken,
          fetchImpl,
          active: input.activation.dependencies,
        }),
        wipState: deriveWipState({
          candidateNumber: item.issueNumber,
          items,
          workStateActive: input.activation.workState,
        }),
        route: routeState(item, input.activation.routes),
        priorityAvailable: input.activation.priority && priority !== null,
        priority,
      };
    }),
  );
}

async function readIssue(input: {
  readonly repository: string;
  readonly issueNumber: number;
  readonly token: string;
  readonly fetchImpl: FetchLike;
}): Promise<RestIssueSnapshot> {
  const response = await input.fetchImpl(
    `https://api.github.com/repos/${input.repository}/issues/${input.issueNumber}`,
    { headers: headers(input.token) },
  );
  if (!response.ok) {
    throw new Error(
      `GitHub issue #${input.issueNumber} query failed with HTTP ${response.status}`,
    );
  }
  return (await response.json()) as RestIssueSnapshot;
}

function issueLabels(issue: RestIssueSnapshot): readonly string[] {
  return issue.labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => typeof label === "string")
    .toSorted((a, b) => {
      if (a === b) {
        return 0;
      }
      return a < b ? -1 : 1;
    });
}

async function readTaskParentState(input: {
  readonly repository: string;
  readonly workNumber: number;
  readonly taskNumber: number;
  readonly token: string;
  readonly fetchImpl: FetchLike;
  readonly active: boolean;
}): Promise<TaskParentState> {
  if (!input.active) {
    return "unavailable";
  }
  const response = await input.fetchImpl(
    `https://api.github.com/repos/${input.repository}/issues/${input.taskNumber}/parent`,
    { headers: headers(input.token) },
  );
  if (response.status === 404) {
    return "mismatch";
  }
  if (!response.ok) {
    return "unavailable";
  }
  const parent = (await response.json()) as RestIssueSnapshot;
  return parent.number === input.workNumber ? "verified" : "mismatch";
}

function isAllowedIntegrationBase(baseRef: string): boolean {
  return baseRef === "main";
}

export async function resolveWorkIntegrationPr(input: {
  readonly repository: string;
  readonly workNumber: number;
  readonly repositoryToken: string;
  readonly active: boolean;
  readonly fetchImpl?: FetchLike;
}): Promise<WorkIntegrationPrResolution> {
  if (!input.active) {
    return { status: "unavailable" };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const referencedNumbers = await readReferencedPullRequests(
    input.repository,
    input.workNumber,
    input.repositoryToken,
    fetchImpl,
  );
  if (!referencedNumbers) {
    return { status: "unavailable" };
  }

  const candidates: WorkIntegrationPrSnapshot[] = [];
  for (const number of referencedNumbers) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${input.repository}/pulls/${number}`,
      { headers: headers(input.repositoryToken) },
    );
    if (!response.ok) {
      return { status: "unavailable" };
    }
    const pullRequest = (await response.json()) as PullRequestSnapshot;
    if (
      pullRequest.state !== "open" ||
      normalizeRepository(pullRequest.head.repo?.full_name ?? "") !==
        normalizeRepository(input.repository) ||
      !isAllowedIntegrationBase(pullRequest.base.ref)
    ) {
      continue;
    }
    candidates.push({
      number: pullRequest.number,
      headRef: pullRequest.head.ref,
      baseRef: pullRequest.base.ref,
    });
  }

  const sorted = candidates.toSorted(
    (left, right) => left.number - right.number,
  );
  if (sorted.length === 0) {
    return { status: "unavailable" };
  }
  if (sorted.length > 1) {
    return { status: "ambiguous", candidates: sorted };
  }

  const pullRequest = sorted[0];
  if (!pullRequest) {
    throw new Error("Work Integration PR selection invariant violated");
  }
  return { status: "selected", pullRequest };
}

function claimState(
  item: ProjectWorkItemSnapshot,
  active: boolean,
): ClaimState {
  if (!active) {
    return "unavailable";
  }
  return parseTaskClaim(item.fields).state;
}

function targetRefState(
  resolution: WorkIntegrationPrResolution,
): TargetRefState {
  if (resolution.status !== "selected") {
    return { ref: null, source: null, authorizedRefs: [] };
  }
  return {
    ref: resolution.pullRequest.headRef,
    source: "authorized-work-context",
    authorizedRefs: [resolution.pullRequest.headRef],
  };
}

export async function readTaskDispatchCandidate(input: {
  readonly repository: string;
  readonly projectId: string;
  readonly projectsToken: string;
  readonly repositoryToken: string;
  readonly workNumber: number;
  readonly taskNumber: number;
  readonly activation: OperationalOwnerActivation;
  readonly fetchImpl?: FetchLike;
}): Promise<TaskDispatchCandidate> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const [items, task, taskParentState, dependencyState, integrationPr] =
    await Promise.all([
      readProjectWorkItems({
        repository: input.repository,
        projectId: input.projectId,
        projectsToken: input.projectsToken,
        fetchImpl,
      }),
      readIssue({
        repository: input.repository,
        issueNumber: input.taskNumber,
        token: input.repositoryToken,
        fetchImpl,
      }),
      readTaskParentState({
        repository: input.repository,
        workNumber: input.workNumber,
        taskNumber: input.taskNumber,
        token: input.repositoryToken,
        fetchImpl,
        active: input.activation.taskParent,
      }),
      readDependencyState({
        repository: input.repository,
        issueNumber: input.taskNumber,
        token: input.repositoryToken,
        fetchImpl,
        active: input.activation.dependencies,
      }),
      resolveWorkIntegrationPr({
        repository: input.repository,
        workNumber: input.workNumber,
        repositoryToken: input.repositoryToken,
        active: input.activation.workIntegrationPr,
        fetchImpl,
      }),
    ]);

  const work = items.find((item) => item.issueNumber === input.workNumber);
  if (!work) {
    throw new Error(
      `Work #${input.workNumber} is not present in the selected Project`,
    );
  }

  const workState = input.activation.workState
    ? parseWorkState(work.fields["Status"])
    : null;

  return {
    workNumber: input.workNumber,
    taskNumber: input.taskNumber,
    workOpen: work.issueOpen,
    taskOpen: task.state === "open",
    taskParentState,
    workStateAvailable: input.activation.workState && workState !== null,
    workState,
    dependencyState,
    route: {
      mappingActive: input.activation.routes,
      labels: issueLabels(task),
    },
    claimState: claimState(work, input.activation.taskClaim),
    targetRef: targetRefState(integrationPr),
  };
}

export function repositoryCoordinates(repository: string): {
  readonly owner: string;
  readonly name: string;
} {
  return repositoryParts(repository);
}

async function readProjectItemsPage(
  projectId: string,
  projectsToken: string,
  after: string | null,
  fetchImpl: FetchLike,
) {
  const response = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${projectsToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: projectItemsQuery,
      variables: { projectId: projectId, after },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub Project item query failed with HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as ProjectItemsQueryResponse;
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `GitHub Project item query failed: ${payload.errors.map((error) => error.message).join("; ")}`,
    );
  }

  const node = payload.data?.node;
  const connection = node?.__typename === "ProjectV2" ? node.items : undefined;
  if (!connection) {
    throw new Error(
      `GitHub Project '${projectId}' was not returned as a ProjectV2`,
    );
  }

  return connection;
}

async function readReferencedPullRequests(
  repository: string,
  workNumber: number,
  token: string,
  fetchImpl: FetchLike,
): Promise<Set<number> | null> {
  const referencedNumbers = new Set<number>();

  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repository}/issues/${workNumber}/timeline?per_page=100&page=${page}`,
      { headers: headers(token) },
    );
    if (!response.ok) {
      return null;
    }

    const events = (await response.json()) as readonly TimelineEvent[];
    for (const event of events) {
      const sourceIssue =
        event.event === "cross-referenced" ? event.source?.issue : undefined;
      if (sourceIssue?.pull_request) {
        referencedNumbers.add(sourceIssue.number);
      }
    }
    if (events.length < 100) {
      break;
    }
    if (page === 20) {
      return null;
    }
  }

  return referencedNumbers;
}
