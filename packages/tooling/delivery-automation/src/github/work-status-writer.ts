import { isDeepStrictEqual } from "node:util";

import type { FetchLike } from "./github-project-inventory.js";
import type { ProjectStatusCommand } from "./project-status-command.js";
import type { ProjectStatusBinding } from "./run-coordinated-status-write.js";

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
            readonly updatedAt: string;
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
              name optionId updatedAt
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

async function projectGraphql<T>(
  api: { readonly fetchImpl?: FetchLike },
  token: string,
  query: string,
  variables: Record<string, string | number>,
): Promise<T | null> {
  const response = await (api.fetchImpl ?? fetch)(
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

export function createCoordinatedProjectStatusWriter(config: {
  readonly projectId: string;
  readonly projectsReadToken: string;
  readonly projectsWriteToken: string;
  readonly repositoryToken: string;
  readonly controllerToken: string;
  readonly fetchImpl?: FetchLike;
}) {
  const tokens = [
    config.projectsReadToken,
    config.projectsWriteToken,
    config.repositoryToken,
    config.controllerToken,
  ];
  if (
    !config.projectId ||
    tokens.some((token) => !token.trim()) ||
    new Set(tokens).size !== tokens.length
  ) {
    return null;
  }

  async function readStatus(command: ProjectStatusCommand) {
    const snapshot = await readCanonicalProjectStatus(
      config,
      config.projectsReadToken,
      config.projectId,
      command.workNumber,
    );
    const from = statusOption(snapshot?.field.options, command.from);
    const to = statusOption(snapshot?.field.options, command.to);
    const current = snapshot?.item.status;
    if (!snapshot || !current || !from || !to) {
      return null;
    }

    return {
      name: current.name,
      updatedAt: current.updatedAt,
      binding: {
        projectId: snapshot.projectId,
        itemId: snapshot.item.id,
        fieldId: snapshot.field.id,
        fromOptionId: from.id,
        toOptionId: to.id,
      },
    };
  }

  return {
    readStatus,
    async writeStatus(
      command: ProjectStatusCommand,
      binding: ProjectStatusBinding,
      authorize: () => Promise<boolean>,
    ): Promise<"unstarted" | "unverified" | "confirmed"> {
      const snapshot = await readStatus(command);
      if (
        snapshot?.name !== command.from ||
        Date.parse(snapshot.updatedAt) !==
          Date.parse(command.statusUpdatedAt) ||
        !isDeepStrictEqual(snapshot.binding, binding) ||
        !(await authorize())
      ) {
        return "unstarted";
      }
      const updated = await updateProjectStatusField(
        config,
        config.projectsWriteToken,
        {
          project: binding.projectId,
          item: binding.itemId,
          field: binding.fieldId,
          option: binding.toOptionId,
        },
      );
      return updated ? "confirmed" : "unverified";
    },
  };
}

async function readCanonicalProjectStatus(
  api: { readonly fetchImpl?: FetchLike },
  token: string,
  projectId: string,
  workNumber: number,
) {
  const result = await projectGraphql<ProjectSnapshot>(api, token, readStatus, {
    number: workNumber,
  });
  const owner = result?.user?.projectV2;
  const issue = result?.repository?.issue;
  if (
    result?.user?.databaseId !== 83680141 ||
    result.repository?.databaseId !== 1336937640 ||
    owner?.closed !== false ||
    owner.id !== projectId ||
    !owner.field?.id ||
    issue?.number !== workNumber ||
    issue.parent !== null ||
    issue.projectItems.pageInfo.hasNextPage !== false
  ) {
    return null;
  }

  const items = issue.projectItems.nodes.filter(
    ({ project }) => project.id === projectId,
  );
  const item = items[0];
  if (
    items.length !== 1 ||
    !item?.id ||
    item.status?.field.id !== owner.field.id ||
    !Number.isFinite(Date.parse(item.status.updatedAt)) ||
    !statusOption(owner.field.options, item.status.name, item.status.optionId)
  ) {
    return null;
  }

  return { projectId, field: owner.field, item };
}

function statusOption(
  options:
    readonly { readonly id: string; readonly name: string }[] | undefined,
  name: string,
  id?: string,
) {
  const matching = options?.filter(
    (option) => option.name === name || option.id === id,
  );
  const option = matching?.[0];
  return matching?.length === 1 &&
    option?.name === name &&
    (id === undefined || option.id === id)
    ? option
    : null;
}

async function updateProjectStatusField(
  api: { readonly fetchImpl?: FetchLike },
  token: string,
  fields: { project: string; item: string; field: string; option: string },
): Promise<boolean> {
  const updated = await projectGraphql<{
    readonly updateProjectV2ItemFieldValue?: {
      readonly projectV2Item?: { readonly id: string };
    };
  }>(api, token, changeStatus, fields);
  return (
    updated?.updateProjectV2ItemFieldValue?.projectV2Item?.id === fields.item
  );
}
