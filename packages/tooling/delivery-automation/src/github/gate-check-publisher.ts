import type { FetchLike } from "./github-project-inventory.js";

export interface PublishedGateCheck {
  readonly id: number;
  readonly url: string;
}

interface CheckRunResponse {
  readonly id?: number;
  readonly html_url?: string;
  readonly app?: { readonly id?: number } | null;
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
  readonly externalId?: string;
  readonly title: string;
  readonly summary: string;
  readonly pass: boolean;
  readonly expectedAppId?: number;
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
      redirect: "error",
      headers: headers(input.repositoryToken),
      body: JSON.stringify({
        name: input.name,
        head_sha: input.headSha,
        external_id: input.externalId,
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
    payload.html_url.length === 0 ||
    (input.expectedAppId !== undefined &&
      payload.app?.id !== input.expectedAppId)
  ) {
    throw new Error(
      "GitHub gate check publication returned an invalid response",
    );
  }

  return { id: payload.id, url: payload.html_url };
}

interface ReservedGateCheckScope {
  readonly repository: string;
  readonly checksToken: string;
  readonly name: string;
  readonly headSha: string;
  readonly reservationId: string;
  readonly expectedAppId: number;
  readonly fetchImpl?: FetchLike;
}

interface ReservedCheckResponse extends CheckRunResponse {
  readonly name?: string;
  readonly head_sha?: string;
  readonly external_id?: string | null;
  readonly status?: string;
  readonly conclusion?: string | null;
}

function reservedCheckEndpoint(scope: ReservedGateCheckScope): string | null {
  if (
    !/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/iu.test(scope.repository) ||
    /\/\.{1,2}$/u.test(scope.repository) ||
    !/^[0-9a-f]{40}$/u.test(scope.headSha) ||
    !scope.name.trim() ||
    !scope.reservationId.trim() ||
    !scope.checksToken.trim() ||
    !Number.isSafeInteger(scope.expectedAppId) ||
    scope.expectedAppId <= 0
  ) {
    return null;
  }
  return `https://api.github.com/repos/${scope.repository}/check-runs`;
}

function verifyReservedCheck(
  value: unknown,
  scope: ReservedGateCheckScope,
  state: "queued" | "completed",
  checkId?: number,
): PublishedGateCheck | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const check = value as ReservedCheckResponse;
  if (
    typeof check.id !== "number" ||
    !Number.isSafeInteger(check.id) ||
    check.id <= 0 ||
    (checkId !== undefined && check.id !== checkId) ||
    typeof check.html_url !== "string" ||
    !check.html_url ||
    check.app?.id !== scope.expectedAppId ||
    check.name !== scope.name ||
    check.head_sha !== scope.headSha ||
    check.external_id !== scope.reservationId ||
    check.status !== state ||
    check.conclusion !== (state === "queued" ? null : "success")
  ) {
    return null;
  }
  return { id: check.id, url: check.html_url };
}

export async function queueReservedGateCheck(
  scope: ReservedGateCheckScope,
): Promise<PublishedGateCheck | null> {
  const endpoint = reservedCheckEndpoint(scope);
  if (!endpoint) {
    return null;
  }

  try {
    const response = await (scope.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      redirect: "error",
      headers: headers(scope.checksToken),
      body: JSON.stringify({
        name: scope.name,
        head_sha: scope.headSha,
        external_id: scope.reservationId,
        status: "queued",
      }),
    });
    return response.status === 201
      ? verifyReservedCheck(await response.json(), scope, "queued")
      : null;
  } catch {
    return null;
  }
}

export async function completeReservedGateCheck(
  scope: ReservedGateCheckScope & {
    readonly checkId: number;
    readonly title: string;
    readonly summary: string;
  },
): Promise<PublishedGateCheck | null> {
  const endpoint = reservedCheckEndpoint(scope);
  if (!endpoint || !Number.isSafeInteger(scope.checkId) || scope.checkId <= 0) {
    return null;
  }

  const fetchImpl = scope.fetchImpl ?? fetch;
  const url = `${endpoint}/${scope.checkId}`;
  const options = {
    redirect: "error",
    headers: headers(scope.checksToken),
  } as const;

  try {
    const current = await fetchImpl(url, options);
    if (
      current.status !== 200 ||
      !verifyReservedCheck(await current.json(), scope, "queued", scope.checkId)
    ) {
      return null;
    }

    const result = await fetchImpl(url, {
      ...options,
      method: "PATCH",
      body: JSON.stringify({
        status: "completed",
        conclusion: "success",
        output: { title: scope.title, summary: scope.summary },
      }),
    });
    return result.status === 200
      ? verifyReservedCheck(
          await result.json(),
          scope,
          "completed",
          scope.checkId,
        )
      : null;
  } catch {
    return null;
  }
}

export async function observeReservedGateCheck(
  scope: ReservedGateCheckScope,
  expected:
    | { readonly state: "queued" }
    | { readonly state: "queued" | "completed"; readonly checkId: number },
): Promise<PublishedGateCheck | null> {
  const endpoint = reservedCheckEndpoint(scope);
  if (!endpoint) {
    return null;
  }
  const fetchImpl = scope.fetchImpl ?? fetch;
  const options = {
    redirect: "error",
    headers: headers(scope.checksToken),
  } as const;

  try {
    if ("checkId" in expected) {
      if (!Number.isSafeInteger(expected.checkId) || expected.checkId <= 0) {
        return null;
      }
      const response = await fetchImpl(
        `${endpoint}/${expected.checkId}`,
        options,
      );
      return response.status === 200
        ? verifyReservedCheck(
            await response.json(),
            scope,
            expected.state,
            expected.checkId,
          )
        : null;
    }

    const repository = `https://api.github.com/repos/${scope.repository}`;
    const query = new URLSearchParams({
      check_name: scope.name,
      filter: "all",
      per_page: "100",
    });
    const response = await fetchImpl(
      `${repository}/commits/${scope.headSha}/check-runs?${query}`,
      options,
    );
    if (response.status !== 200 || response.headers.has("link")) {
      return null;
    }
    const payload = (await response.json()) as {
      readonly total_count?: number;
      readonly check_runs?: readonly (ReservedCheckResponse | null)[];
    } | null;
    if (
      !Array.isArray(payload?.check_runs) ||
      payload.total_count !== payload.check_runs.length
    ) {
      return null;
    }
    const matches = payload.check_runs.filter(
      (check) =>
        check?.external_id === scope.reservationId &&
        check?.app?.id === scope.expectedAppId,
    );
    return matches.length === 1
      ? verifyReservedCheck(matches[0], scope, "queued")
      : null;
  } catch {
    return null;
  }
}
