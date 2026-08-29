import type { FetchLike } from "./github-project-inventory.js";

export interface PublishedGateCheck {
  readonly id: number;
  readonly url: string;
}

interface CheckRunResponse {
  readonly id?: number;
  readonly html_url?: string;
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2026-03-10",
  };
}

export async function publishGateCheck(input: {
  readonly repository: string;
  readonly repositoryToken: string;
  readonly name: string;
  readonly headSha: string;
  readonly title: string;
  readonly summary: string;
  readonly pass: boolean;
  readonly fetchImpl?: FetchLike;
}): Promise<PublishedGateCheck> {
  if (!/^[0-9a-f]{40}$/i.test(input.headSha)) {
    throw new Error(`Invalid gate check head SHA '${input.headSha}'`);
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.github.com/repos/${input.repository}/check-runs`,
    {
      method: "POST",
      headers: headers(input.repositoryToken),
      body: JSON.stringify({
        name: input.name,
        head_sha: input.headSha,
        status: "completed",
        conclusion: input.pass ? "success" : "failure",
        output: {
          title: input.title,
          summary: input.summary,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub gate check publication failed with HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as CheckRunResponse;
  if (
    typeof payload.id !== "number" ||
    !Number.isSafeInteger(payload.id) ||
    payload.id <= 0 ||
    typeof payload.html_url !== "string" ||
    payload.html_url.length === 0
  ) {
    throw new Error("GitHub gate check publication returned an invalid response");
  }

  return { id: payload.id, url: payload.html_url };
}
