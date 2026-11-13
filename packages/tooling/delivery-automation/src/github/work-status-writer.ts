import { createHash } from "node:crypto";

import type { WorkState } from "../control/eligibility.js";
import {
  executeReservedGitHubInvalidation,
  reconcileReservedGitHubInvalidation,
} from "./reserved-work-integration.js";

interface StatusValue {
  readonly name: WorkState;
  readonly optionId: string;
}

interface WorkStatusChange {
  readonly projectId: string;
  readonly itemId: string;
  readonly fieldId: string;
  readonly from: StatusValue;
  readonly to: StatusValue;
}

type ControllerInput = Parameters<typeof executeReservedGitHubInvalidation>[0];
type StatusInput = Pick<
  ControllerInput,
  "candidate" | "authorize" | "scope"
> & {
  readonly change: WorkStatusChange;
};

interface ProjectSnapshot {
  readonly user?: {
    readonly databaseId: number;
    readonly projectV2?: {
      readonly id: string;
      readonly closed: boolean;
      readonly field?: {
        readonly id: string;
        readonly options?: readonly {
          readonly id: string;
          readonly name: string;
        }[];
      };
    };
  };
  readonly repository?: {
    readonly databaseId: number;
    readonly issue?: {
      readonly number: number;
      readonly parent: { readonly id: string } | null;
      readonly projectItems: {
        readonly nodes: readonly {
          readonly id: string;
          readonly project: { readonly id: string };
          readonly status?: {
            readonly name: string;
            readonly optionId: string;
            readonly field: { readonly id: string };
          };
        }[];
        readonly pageInfo: { readonly hasNextPage: boolean };
      };
    };
  };
}

const readStatus = `query ArchitectureWebWorkStatus($number: Int!) {
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
        nodes {
          id project { id }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name optionId
              field { ... on ProjectV2SingleSelectField { id } }
            }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  }
}`;

const changeStatus = `mutation ArchitectureWebChangeWorkStatus($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option }
  }) { projectV2Item { id } }
}`;

export function workStatusChangeId(
  candidate: StatusInput["candidate"],
  change: WorkStatusChange,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "architecture-web:project-3:work-status",
        candidate.workNumber,
        candidate.pullNumber,
        candidate.headSha,
        candidate.baseSha,
        change.projectId,
        change.itemId,
        change.fieldId,
        change.from.name,
        change.from.optionId,
        change.to.name,
        change.to.optionId,
      ]),
    )
    .digest("hex");
}

function validStatusBinding(input: StatusInput): boolean {
  const { publisher } = input.scope;
  const { projectId, itemId, fieldId, from, to } = input.change;
  return (
    publisher.activation.workState === true &&
    publisher.projectId === projectId &&
    publisher.projectsToken.trim() !== "" &&
    from.name !== to.name &&
    from.optionId !== to.optionId &&
    [projectId, itemId, fieldId, from.optionId, to.optionId].every(
      (id) => id.trim() !== "",
    )
  );
}

async function projectGraphql<T>(
  input: StatusInput,
  token: string,
  query: string,
  variables: Record<string, string | number>,
): Promise<T | null> {
  const response = await (input.scope.publisher.fetchImpl ?? fetch)(
    "https://api.github.com/graphql",
    {
      method: "POST",
      redirect: "error",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (response.status !== 200) {
    return null;
  }
  const result = (await response.json()) as {
    readonly data?: T;
    readonly errors?: readonly unknown[];
  } | null;
  return result?.errors?.length ? null : (result?.data ?? null);
}

async function matchesProjectStatus(
  input: StatusInput,
  expected: StatusValue,
): Promise<boolean> {
  const { candidate, change } = input;
  const result = await projectGraphql<ProjectSnapshot>(
    input,
    input.scope.publisher.projectsToken,
    readStatus,
    { number: candidate.workNumber },
  );
  const owner = result?.user?.projectV2;
  const issue = result?.repository?.issue;
  if (
    result?.user?.databaseId !== 83680141 ||
    result.repository?.databaseId !== 1336937640 ||
    owner?.closed !== false ||
    owner.id !== change.projectId ||
    owner.field?.id !== change.fieldId ||
    issue?.number !== candidate.workNumber ||
    issue.parent !== null ||
    issue.projectItems.pageInfo.hasNextPage !== false
  ) {
    return false;
  }
  for (const value of [change.from, change.to]) {
    const options = owner.field.options?.filter(
      ({ name, id }) => name === value.name || id === value.optionId,
    );
    if (
      options?.length !== 1 ||
      options[0]?.id !== value.optionId ||
      options[0].name !== value.name
    ) {
      return false;
    }
  }
  const items = issue.projectItems.nodes.filter(
    ({ project }) => project.id === change.projectId,
  );
  const item = items[0];
  return (
    items.length === 1 &&
    item?.id === change.itemId &&
    item.status?.field.id === change.fieldId &&
    item.status.name === expected.name &&
    item.status.optionId === expected.optionId
  );
}

export async function executeReservedProjectStatusChange(
  input: StatusInput & {
    readonly standingEnabled?: boolean;
    readonly projectsWriteToken: string;
  },
): ReturnType<typeof executeReservedGitHubInvalidation> {
  if (input.standingEnabled !== true) {
    return { status: "inactive" };
  }
  const candidate = structuredClone(input.candidate);
  const change = structuredClone(input.change);
  const { projectsWriteToken, scope } = input;
  const command = { ...input, candidate, change };
  const { publisher } = scope;
  if (
    !validStatusBinding(input) ||
    !projectsWriteToken.trim() ||
    [
      scope.checksToken,
      publisher.projectsToken,
      publisher.repositoryToken,
      publisher.mergeToken,
    ].includes(projectsWriteToken)
  ) {
    return { status: "denied" };
  }

  // The caller must establish the Method transition and its authority. The
  // controller only records it when this exact command is authorized.
  const writeId = workStatusChangeId(candidate, change);
  try {
    if (
      !(await input.authorize({ candidate, operation: "invalidate", writeId }))
    ) {
      return { status: "denied" };
    }
    if (!(await matchesProjectStatus(command, change.from))) {
      return { status: "deferred" };
    }
  } catch {
    return { status: "deferred" };
  }
  return executeReservedGitHubInvalidation({
    candidate,
    scope,
    authorize: input.authorize,
    standingEnabled: true,
    writeId,
    apply: async () => {
      if (!(await matchesProjectStatus(command, change.from))) {
        return false;
      }
      const updated = await projectGraphql<{
        readonly updateProjectV2ItemFieldValue?: {
          readonly projectV2Item?: { readonly id: string };
        };
      }>(command, projectsWriteToken, changeStatus, {
        project: change.projectId,
        item: change.itemId,
        field: change.fieldId,
        option: change.to.optionId,
      });
      return (
        updated?.updateProjectV2ItemFieldValue?.projectV2Item?.id ===
          change.itemId && (await matchesProjectStatus(command, change.to))
      );
    },
  });
}

export async function reconcileReservedProjectStatusChange(
  input: StatusInput,
): ReturnType<typeof reconcileReservedGitHubInvalidation> {
  if (!validStatusBinding(input)) {
    return { status: "denied" };
  }
  return reconcileReservedGitHubInvalidation({
    candidate: input.candidate,
    scope: input.scope,
    authorize: input.authorize,
    writeId: workStatusChangeId(input.candidate, input.change),
    observeApplied: () => matchesProjectStatus(input, input.change.to),
  });
}
