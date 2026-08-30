import type {
  ProjectFieldSnapshot,
  ProjectSnapshot,
  ProjectViewSnapshot,
} from "../inventory/project-inventory.js";

export interface GitHubInventorySnapshot {
  readonly projects: readonly ProjectSnapshot[];
  readonly labels: readonly string[];
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface GraphQlError {
  readonly message: string;
}

interface ProjectFieldNode {
  readonly __typename: string;
  readonly id?: string;
  readonly name?: string;
  readonly dataType?: string;
  readonly options?: readonly { readonly name: string }[];
}

interface FieldConnection {
  readonly nodes: readonly ProjectFieldNode[];
  readonly pageInfo: { readonly hasNextPage: boolean };
}

interface ProjectViewNode {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly layout: string;
  readonly filter: string | null;
  readonly fields: FieldConnection;
  readonly groupByFields: FieldConnection;
  readonly verticalGroupByFields: FieldConnection;
}

interface ProjectNode {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly closed: boolean;
  readonly owner: { readonly login?: string };
  readonly repositories: {
    readonly nodes: readonly { readonly nameWithOwner: string }[];
    readonly pageInfo: { readonly hasNextPage: boolean };
  };
  readonly fields: FieldConnection;
  readonly views: {
    readonly nodes: readonly ProjectViewNode[];
    readonly pageInfo: { readonly hasNextPage: boolean };
  };
}

interface ProjectsQueryResponse {
  readonly data?: {
    readonly repository?: {
      readonly projectsV2: {
        readonly nodes: readonly ProjectNode[];
        readonly pageInfo: {
          readonly hasNextPage: boolean;
          readonly endCursor: string | null;
        };
      };
    } | null;
  };
  readonly errors?: readonly GraphQlError[];
}

const fieldSelection = `
  __typename
  ... on ProjectV2Field {
    id
    name
    dataType
  }
  ... on ProjectV2SingleSelectField {
    id
    name
    dataType
    options { name }
  }
  ... on ProjectV2MultiSelectField {
    id
    name
    dataType
  }
  ... on ProjectV2IterationField {
    id
    name
    dataType
  }
`;

// Keep the outer Project page deliberately small. GitHub computes GraphQL node
// limits from the product of nested connection bounds, so requesting 100
// Projects × 100 views × 100 fields can exceed the 500,000-node query limit
// before any data is returned. The outer connection is cursor-paginated below,
// so a smaller page preserves complete inventory without weakening fail-closed
// checks on the nested Project configuration.
const projectsPageSize = 10;

const projectsQuery = `
  query ArchitectureWebDeliveryProjects(
    $owner: String!
    $name: String!
    $after: String
  ) {
    repository(owner: $owner, name: $name) {
      projectsV2(first: ${projectsPageSize}, after: $after) {
        nodes {
          id
          number
          title
          url
          closed
          owner {
            ... on User { login }
            ... on Organization { login }
          }
          repositories(first: 100) {
            nodes { nameWithOwner }
            pageInfo { hasNextPage }
          }
          fields(first: 100) {
            nodes { ${fieldSelection} }
            pageInfo { hasNextPage }
          }
          views(first: 100) {
            nodes {
              id
              number
              name
              layout
              filter
              fields(first: 100) {
                nodes { ${fieldSelection} }
                pageInfo { hasNextPage }
              }
              groupByFields(first: 20) {
                nodes { ${fieldSelection} }
                pageInfo { hasNextPage }
              }
              verticalGroupByFields(first: 20) {
                nodes { ${fieldSelection} }
                pageInfo { hasNextPage }
              }
            }
            pageInfo { hasNextPage }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

function splitRepository(repository: string): { owner: string; name: string } {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid GitHub repository '${repository}', expected owner/name`,
    );
  }

  return { owner: parts[0], name: parts[1] };
}

function toFieldSnapshot(node: ProjectFieldNode): ProjectFieldSnapshot | null {
  if (!node.id || !node.name || !node.dataType) {
    return null;
  }

  return {
    id: node.id,
    name: node.name,
    dataType: node.dataType,
    ...(node.options
      ? { options: node.options.map((option) => option.name) }
      : {}),
  };
}

function fieldNames(
  connection: FieldConnection,
  context: string,
): readonly string[] {
  if (connection.pageInfo.hasNextPage) {
    throw new Error(
      `${context} exceeds the inventory page limit; inventory is incomplete`,
    );
  }

  const names: string[] = [];
  for (const node of connection.nodes) {
    if (!node.name) {
      throw new Error(`${context} contains an unsupported field configuration`);
    }
    names.push(node.name);
  }
  return names;
}

function toViewSnapshot(
  node: ProjectViewNode,
  projectNumber: number,
): ProjectViewSnapshot {
  return {
    id: node.id,
    number: node.number,
    name: node.name,
    layout: node.layout,
    filter: node.filter,
    visibleFields: fieldNames(
      node.fields,
      `Project ${projectNumber} view '${node.name}' visible fields`,
    ),
    groupByFields: fieldNames(
      node.groupByFields,
      `Project ${projectNumber} view '${node.name}' group-by fields`,
    ),
    verticalGroupByFields: fieldNames(
      node.verticalGroupByFields,
      `Project ${projectNumber} view '${node.name}' vertical group-by fields`,
    ),
  };
}

function toProjectSnapshot(node: ProjectNode): ProjectSnapshot {
  if (node.repositories.pageInfo.hasNextPage) {
    throw new Error(
      `Project ${node.number} is linked to more than 100 repositories; inventory is incomplete`,
    );
  }
  if (node.fields.pageInfo.hasNextPage) {
    throw new Error(
      `Project ${node.number} has more than 100 fields; inventory is incomplete`,
    );
  }
  if (node.views.pageInfo.hasNextPage) {
    throw new Error(
      `Project ${node.number} has more than 100 views; inventory is incomplete`,
    );
  }

  const owner = node.owner.login;
  if (!owner) {
    throw new Error(`Project ${node.number} owner could not be resolved`);
  }

  return {
    id: node.id,
    owner,
    number: node.number,
    title: node.title,
    url: node.url,
    closed: node.closed,
    repositories: node.repositories.nodes.map(
      (repository) => repository.nameWithOwner,
    ),
    fields: node.fields.nodes
      .map(toFieldSnapshot)
      .filter((field): field is ProjectFieldSnapshot => field !== null),
    views: node.views.nodes.map((view) => toViewSnapshot(view, node.number)),
  };
}

async function readProjects(input: {
  readonly repository: string;
  readonly token: string;
  readonly fetchImpl: FetchLike;
}): Promise<readonly ProjectSnapshot[]> {
  const { owner, name } = splitRepository(input.repository);
  const projects: ProjectSnapshot[] = [];
  let after: string | null = null;

  do {
    const response = await input.fetchImpl("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: projectsQuery,
        variables: { owner, name, after },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `GitHub Projects query failed with HTTP ${response.status}`,
      );
    }

    const payload = (await response.json()) as ProjectsQueryResponse;
    if (payload.errors && payload.errors.length > 0) {
      throw new Error(
        `GitHub Projects query failed: ${payload.errors.map((error) => error.message).join("; ")}`,
      );
    }

    const repository = payload.data?.repository;
    if (!repository) {
      throw new Error(
        `GitHub repository '${input.repository}' was not returned by GraphQL`,
      );
    }

    projects.push(...repository.projectsV2.nodes.map(toProjectSnapshot));
    after = repository.projectsV2.pageInfo.hasNextPage
      ? repository.projectsV2.pageInfo.endCursor
      : null;

    if (repository.projectsV2.pageInfo.hasNextPage && !after) {
      throw new Error(
        "GitHub Projects pagination reported another page without a cursor",
      );
    }
  } while (after);

  return projects;
}

async function readLabels(input: {
  readonly repository: string;
  readonly token: string;
  readonly fetchImpl: FetchLike;
}): Promise<readonly string[]> {
  const labels: string[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const response = await input.fetchImpl(
      `https://api.github.com/repos/${input.repository}/labels?per_page=100&page=${page}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${input.token}`,
          "x-github-api-version": "2026-03-10",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `GitHub labels query failed with HTTP ${response.status}`,
      );
    }

    const pageLabels = (await response.json()) as readonly {
      readonly name: string;
    }[];
    labels.push(...pageLabels.map((label) => label.name));

    if (pageLabels.length < 100) {
      return labels.toSorted();
    }
  }

  throw new Error(
    "GitHub label inventory exceeded 2000 labels; refusing truncated inventory",
  );
}

export async function readGitHubInventory(input: {
  readonly repository: string;
  readonly projectsToken: string;
  readonly repositoryToken?: string;
  readonly fetchImpl?: FetchLike;
}): Promise<GitHubInventorySnapshot> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const repositoryToken = input.repositoryToken ?? input.projectsToken;

  const [projects, labels] = await Promise.all([
    readProjects({
      repository: input.repository,
      token: input.projectsToken,
      fetchImpl,
    }),
    readLabels({
      repository: input.repository,
      token: repositoryToken,
      fetchImpl,
    }),
  ]);

  return { projects, labels };
}
