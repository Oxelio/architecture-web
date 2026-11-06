import {
  positiveInteger,
  requiredEnvironment,
} from "./gate-publication-support.js";

export function requireTrustedMain(...events: readonly string[]): void {
  if (
    process.env["GITHUB_REPOSITORY"]?.toLowerCase() !==
      "oxelio/architecture-web" ||
    process.env["GITHUB_REPOSITORY_ID"] !== "1336937640" ||
    process.env["GITHUB_REF"] !== "refs/heads/main" ||
    process.env["GITHUB_RUN_ATTEMPT"] !== "1" ||
    !process.env["GITHUB_SHA"] ||
    process.env["GITHUB_SHA"] !== process.env["TRUSTED_WORKFLOW_SHA"] ||
    !events.includes(process.env["GITHUB_EVENT_NAME"] ?? "")
  ) {
    throw new Error("A fresh event on the trusted main revision is required");
  }
}

export async function githubRepositoryRequest<T>(
  path: string,
  body?: object,
): Promise<T> {
  const response = await fetch(
    `https://api.github.com/repos/Oxelio/architecture-web${path}`,
    {
      method: body ? "PATCH" : "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${requiredEnvironment("GITHUB_TOKEN")}`,
        "content-type": "application/json",
        // Closure verifies the squash SHA from the pull request response.
        "x-github-api-version": "2022-11-28",
      },
      redirect: "error",
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(
      `GitHub repository request failed with HTTP ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

export async function readMaintainerRecord<T>(
  variable: string,
  workNumber: number,
): Promise<T | null> {
  if (!process.env[variable]) {
    return null;
  }
  return readDirectMaintainerRecord<T>(positiveInteger(variable), workNumber);
}

export async function readDirectMaintainerRecord<T>(
  id: number,
  workNumber: number,
): Promise<T | null> {
  const record = await githubRepositoryRequest<{
    readonly id: number;
    readonly issue_url: string;
    readonly user?: { readonly id: number; readonly type: string };
    readonly performed_via_github_app?: object | null;
    readonly created_at: string;
    readonly updated_at: string;
    readonly body: string;
  }>(`/issues/comments/${id}`);
  if (
    record.id !== id ||
    record.issue_url.toLowerCase() !==
      `https://api.github.com/repos/oxelio/architecture-web/issues/${workNumber}` ||
    record.user?.id !== 83680141 ||
    record.user.type !== "User" ||
    record.performed_via_github_app !== null ||
    !record.created_at ||
    record.created_at !== record.updated_at
  ) {
    return null;
  }
  try {
    return JSON.parse(record.body) as T;
  } catch {
    return null;
  }
}
