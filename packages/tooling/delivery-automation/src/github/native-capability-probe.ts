import type { FetchLike } from "./github-project-inventory.js";

export interface NativeDeliveryCapabilityProbe {
  readonly dependencies: boolean;
  readonly taskParent: boolean;
  readonly workIntegrationPr: boolean;
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
  };
}

export async function probeNativeDeliveryCapabilities(input: {
  readonly repository: string;
  readonly issueNumber: number;
  readonly repositoryToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<NativeDeliveryCapabilityProbe> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const requestHeaders = headers(input.repositoryToken);

  const [dependencies, parent, timeline] = await Promise.all([
    fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.issueNumber}/dependencies/blocked_by?per_page=1`,
      { headers: requestHeaders },
    ),
    fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.issueNumber}/parent`,
      { headers: requestHeaders },
    ),
    fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.issueNumber}/timeline?per_page=1`,
      { headers: requestHeaders },
    ),
  ]);

  return {
    dependencies: dependencies.ok,
    taskParent: parent.ok || parent.status === 404,
    workIntegrationPr: timeline.ok,
  };
}
