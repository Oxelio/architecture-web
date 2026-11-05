import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

import {
  publishWorkCompletion,
  type WorkCompletionSnapshot,
} from "../control/work-completion.js";
import {
  type CompletionRecord,
  isCompletionRecord,
  issueDisposition,
  matchesCompletedCandidate,
  workReference,
} from "../github/work-completion-evidence.js";
import {
  positiveInteger,
  readActivationManifest,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";
import {
  githubRepositoryRequest,
  requireTrustedMain,
} from "./work-pilot-support.js";

requireTrustedMain("pull_request_target", "workflow_dispatch");
const pullNumber = positiveInteger("COMPLETION_PULL_NUMBER");
const event = JSON.parse(
  await readFile(requiredEnvironment("GITHUB_EVENT_PATH"), "utf8"),
) as {
  readonly repository?: { readonly id?: number };
  readonly pull_request?: {
    readonly number?: number;
    readonly merged?: boolean;
  };
  readonly inputs?: { readonly pull_number?: string };
};
if (
  event.repository?.id !== 1336937640 ||
  (process.env["GITHUB_EVENT_NAME"] === "workflow_dispatch"
    ? positiveInteger("GITHUB_ACTOR_ID") !== 83680141 ||
      event.inputs?.pull_number !== String(pullNumber)
    : event.pull_request?.number !== pullNumber ||
      event.pull_request.merged !== true)
) {
  throw new Error("The event does not authorize completion for this candidate");
}
const manifest = await readActivationManifest();
if (
  manifest.project?.owner !== "Oxelio" ||
  manifest.project.number !== 3 ||
  manifest.mappings.workState.status !== "verified"
) {
  throw new Error("The personal Project Work State owner is unavailable");
}

type MergedPullRequest = Parameters<typeof matchesCompletedCandidate>[1];
const integrated = await githubRepositoryRequest<MergedPullRequest>(
  `/pulls/${pullNumber}`,
);
const owner = workReference(integrated.body);
if (
  integrated.number !== pullNumber ||
  integrated.state !== "closed" ||
  integrated.merged !== true ||
  integrated.base.ref !== "main" ||
  integrated.base.repo.id !== 1336937640 ||
  integrated.head.repo?.id !== 1336937640 ||
  !/^[0-9a-f]{40}$/u.test(integrated.merge_commit_sha) ||
  owner === null
) {
  throw new Error("An integrated Work PR with one owning Issue is required");
}
const workNumber = owner;
const mergeSha = integrated.merge_commit_sha;

if (process.env["COMPLETION_WAIT_FOR_DOWNSTREAM"] === "true") {
  // Initial merge events can arrive before either push workflow has finished.
  // The existing authenticated recovery remains available for longer runs.
  for (let attempt = 0; attempt < 18; attempt += 1) {
    if ((await downstreamResults(mergeSha)).every(Boolean)) {
      break;
    }
    await setTimeout(20_000);
  }
}

let verifiedItem: {
  readonly projectId: string;
  readonly itemId: string;
  readonly fieldId: string;
  readonly doneId: string;
} | null = null;
const result = await publishWorkCompletion({
  read: readSnapshot,
  writeDone: async (itemId) => {
    const item = verifiedItem;
    if (!item || item.itemId !== itemId) {
      throw new Error("Project item identity changed");
    }
    const response = await projectGraphql<{
      readonly updateProjectV2ItemFieldValue: {
        readonly projectV2Item: { readonly id: string };
      };
    }>(
      `mutation($project: ID!, $item: ID!, $field: ID!, $done: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $done }
        }) { projectV2Item { id } }
      }`,
      {
        project: item.projectId,
        item: item.itemId,
        field: item.fieldId,
        done: item.doneId,
      },
    );
    if (response.updateProjectV2ItemFieldValue.projectV2Item.id !== itemId) {
      throw new Error("Unexpected Project item mutation response");
    }
  },
  closeCompleted: async (number) => {
    if (number !== workNumber) {
      throw new Error("Work identity changed before Issue closure");
    }
    await githubRepositoryRequest(`/issues/${number}`, {
      state: "closed",
      state_reason: "completed",
    });
  },
});
writeJson({ workNumber, pullNumber, result });
if (result.status === "blocked" || result.status === "retry") {
  process.exitCode = 2;
}

async function readSnapshot(): Promise<WorkCompletionSnapshot | null> {
  verifiedItem = null;
  const record = await readCompletionRecord(workNumber, pullNumber, mergeSha);
  if (
    !isCompletionRecord(record, pullNumber) ||
    record.workNumber !== workNumber
  ) {
    return null;
  }
  const [
    pr,
    commit,
    comparison,
    issue,
    events,
    [ci, release],
    tasks,
    dependencies,
  ] = await Promise.all([
    githubRepositoryRequest<Parameters<typeof matchesCompletedCandidate>[1]>(
      `/pulls/${pullNumber}`,
    ),
    githubRepositoryRequest<Parameters<typeof matchesCompletedCandidate>[2]>(
      `/commits/${mergeSha}`,
    ),
    githubRepositoryRequest<Parameters<typeof matchesCompletedCandidate>[3]>(
      `/compare/${mergeSha}...main?per_page=1`,
    ),
    githubRepositoryRequest<
      Parameters<typeof issueDisposition>[0] & {
        readonly number: number;
        readonly pull_request?: object;
        readonly repository_url: string;
      }
    >(`/issues/${workNumber}`),
    githubRepositoryRequest<Parameters<typeof issueDisposition>[1]>(
      `/issues/${workNumber}/events?per_page=100`,
    ),
    downstreamResults(mergeSha),
    githubRepositoryRequest<
      readonly {
        readonly state: string;
        readonly state_reason: string | null;
      }[]
    >(`/issues/${workNumber}/sub_issues?per_page=100`),
    githubRepositoryRequest<
      readonly {
        readonly state: string;
      }[]
    >(`/issues/${workNumber}/dependencies/blocked_by?per_page=100`),
  ]);
  if (
    !matchesCompletedCandidate(record, pr, commit, comparison, 1336937640) ||
    issue.number !== workNumber ||
    issue.pull_request !== undefined ||
    issue.repository_url.toLowerCase() !==
      "https://api.github.com/repos/oxelio/architecture-web" ||
    !Array.isArray(tasks) ||
    tasks.length >= 100 ||
    tasks.some(
      (task) => task.state !== "closed" || task.state_reason !== "completed",
    ) ||
    !Array.isArray(dependencies) ||
    dependencies.length >= 100 ||
    dependencies.some((dependency) => dependency.state !== "closed")
  ) {
    return null;
  }
  const project = await projectGraphql<{
    readonly user?: {
      readonly databaseId: number;
      readonly projectV2?: {
        readonly id: string;
        readonly closed: boolean;
        readonly field?: {
          readonly id: string;
          readonly options?: readonly {
            readonly name: string;
            readonly id: string;
          }[];
        };
      };
    };
    readonly repository?: {
      readonly databaseId: number;
      readonly issue?: {
        readonly number: number;
        readonly parent: object | null;
        readonly projectItems: {
          readonly nodes: readonly {
            readonly id: string;
            readonly project: { readonly id: string };
            readonly status?: { readonly name: string };
          }[];
          readonly pageInfo: { readonly hasNextPage: boolean };
        };
      };
    };
  }>(
    `query($number: Int!) {
      user(login: "Oxelio") {
        databaseId
        projectV2(number: 3) {
          id closed
          field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
        }
      }
      repository(owner: "Oxelio", name: "architecture-web") {
        databaseId
        issue(number: $number) {
          number parent { id }
          projectItems(first: 100, includeArchived: false) {
            nodes { id project { id } status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            } }
            pageInfo { hasNextPage }
          }
        }
      }
    }`,
    { number: workNumber },
  );
  const owner = project.user?.projectV2;
  const work = project.repository?.issue;
  if (
    project.user?.databaseId !== 83680141 ||
    project.repository?.databaseId !== 1336937640 ||
    owner?.closed !== false ||
    !owner.id ||
    !owner.field?.id ||
    work?.number !== workNumber ||
    work.parent !== null ||
    work.projectItems.pageInfo.hasNextPage !== false
  ) {
    return null;
  }
  const items = work.projectItems.nodes.filter(
    (item) => item.project.id === owner.id,
  );
  const doneOptions = owner.field.options?.filter(
    (option) => option.name === "Done",
  );
  const item = items[0];
  const done = doneOptions?.[0];
  const status = item?.status?.name;
  if (
    items.length !== 1 ||
    doneOptions?.length !== 1 ||
    !item?.id ||
    !done?.id ||
    (status !== "Validating" && status !== "Done")
  ) {
    return null;
  }
  verifiedItem = {
    projectId: owner.id,
    itemId: item.id,
    fieldId: owner.field.id,
    doneId: done.id,
  };
  return {
    ...record,
    baseRef: "main",
    status,
    projectItemId: item.id,
    issueDisposition: issueDisposition(issue, events),
    validationSufficient: record.validationSufficient === true && ci,
    postMergeObligationsSatisfied:
      record.postMergeObligationsSatisfied === true && release,
  };
}

async function readCompletionRecord(
  work: number,
  pull: number,
  merge: string,
): Promise<CompletionRecord | null> {
  const comments = await githubRepositoryRequest<
    readonly {
      readonly issue_url: string;
      readonly user?: { readonly id: number; readonly type: string };
      readonly performed_via_github_app?: object | null;
      readonly created_at: string;
      readonly updated_at: string;
      readonly body: string;
    }[]
  >(`/issues/${work}/comments?per_page=100`);
  if (!Array.isArray(comments) || comments.length >= 100) {
    return null;
  }
  for (const comment of [...comments].reverse()) {
    if (
      comment.user?.id !== 83680141 ||
      comment.user.type !== "User" ||
      comment.performed_via_github_app !== null ||
      comment.issue_url.toLowerCase() !==
        `https://api.github.com/repos/oxelio/architecture-web/issues/${work}`
    ) {
      continue;
    }
    let record: CompletionRecord | null;
    try {
      record = JSON.parse(comment.body) as CompletionRecord | null;
    } catch {
      continue;
    }
    if (
      record?.kind === "work-completion" &&
      record.pullNumber === pull &&
      record.mergeSha === merge
    ) {
      return comment.created_at && comment.created_at === comment.updated_at
        ? record
        : null;
    }
  }
  return null;
}

function downstreamResults(sha: string): Promise<[boolean, boolean]> {
  return Promise.all([
    successfulPushRun("delivery-automation-validation.yml", sha),
    successfulPushRun("release.yml", sha),
  ]);
}

async function successfulPushRun(
  workflow: string,
  sha: string,
): Promise<boolean> {
  const result = await githubRepositoryRequest<{
    readonly workflow_runs: readonly {
      readonly head_sha: string;
      readonly head_branch: string;
      readonly event: string;
      readonly status: string;
      readonly conclusion: string;
    }[];
  }>(
    `/actions/workflows/${workflow}/runs?event=push&head_sha=${sha}&per_page=10`,
  );
  const latest = result.workflow_runs[0];
  return (
    latest?.head_sha === sha &&
    latest.head_branch === "main" &&
    latest.event === "push" &&
    latest.status === "completed" &&
    latest.conclusion === "success"
  );
}

async function projectGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${requiredEnvironment("COMPLETION_PROJECTS_TOKEN")}`,
      "content-type": "application/json",
    },
    redirect: "error",
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(
      `GitHub Project request failed with HTTP ${response.status}`,
    );
  }
  const payload = (await response.json()) as {
    readonly data?: T;
    readonly errors?: readonly unknown[];
  };
  if (!payload.data || payload.errors?.length) {
    throw new Error("GitHub Project request did not return trusted data");
  }
  return payload.data;
}
