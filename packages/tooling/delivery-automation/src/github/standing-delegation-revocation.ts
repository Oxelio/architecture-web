import type { FetchLike } from "./github-project-inventory.js";

const repository = "https://api.github.com/repos/Oxelio/architecture-web";
const oid = /^[0-9a-f]{40}$/u;

interface RevocationScope {
  readonly repositoryToken: string;
  readonly delegationCommentId: number;
  readonly fetchImpl?: FetchLike;
}

function refName(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("INVALID_STANDING_DELEGATION_ID");
  }
  return `tags/delivery-control/disabled-${id}`;
}

function request(scope: RevocationScope, path: string, body?: object) {
  if (!scope.repositoryToken.trim()) {
    throw new Error("STANDING_REVOCATION_TOKEN_REQUIRED");
  }
  return (scope.fetchImpl ?? fetch)(`${repository}/git/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${scope.repositoryToken}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    redirect: "error",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function isMarker(value: unknown, ref: string): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const marker = value as {
    readonly ref?: string;
    readonly object?: { readonly type?: string; readonly sha?: string };
  };
  return (
    marker.ref === `refs/${ref}` &&
    marker.object?.type === "commit" &&
    typeof marker.object.sha === "string" &&
    oid.test(marker.object.sha)
  );
}

// Callers must establish that only the authorized controller can create
// these refs and that existing refs cannot be modified or removed.
export async function isStandingDelegationRevoked(scope: RevocationScope) {
  const ref = refName(scope.delegationCommentId);
  const response = await request(scope, `ref/${ref}`);
  if (response.status === 404) {
    return false;
  }
  if (response.status !== 200 || !isMarker(await response.json(), ref)) {
    throw new Error("STANDING_REVOCATION_MARKER_UNVERIFIED");
  }
  return true;
}

// Run inside the protected Actions job shared with final publication.
// A matching ref is durable evidence. A lost response never causes a write retry.
export async function recordStandingDelegationRevocation(
  scope: RevocationScope & { readonly workflowSha: string },
): Promise<boolean> {
  const ref = refName(scope.delegationCommentId);
  if (!oid.test(scope.workflowSha)) {
    return false;
  }
  if (await isStandingDelegationRevoked(scope)) {
    return true;
  }

  try {
    const response = await request(scope, "refs", {
      ref: `refs/${ref}`,
      sha: scope.workflowSha,
    });
    if (response.status === 201 && !isMarker(await response.json(), ref)) {
      return false;
    }
  } catch {
    // Inspect the exact ref even when GitHub's response is lost.
  }
  return isStandingDelegationRevoked(scope);
}
