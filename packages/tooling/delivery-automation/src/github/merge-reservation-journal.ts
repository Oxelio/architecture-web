import type { FetchLike } from "./github-project-inventory.js";

const gitApi = "https://api.github.com/repos/Oxelio/architecture-web/git";
const oid = /^[0-9a-f]{40}$/u;

interface TagObject {
  readonly tag?: string;
  readonly sha?: string;
  readonly message?: string;
  readonly object?: { readonly type: string; readonly sha: string };
}

interface TagReference {
  readonly ref?: string;
  readonly object?: { readonly type: string; readonly sha: string };
}

export interface MergeJournalPosition {
  readonly revision: number;
  readonly tagSha: string;
}

interface MergeJournalPayload {
  readonly revision: number;
  readonly previous: string | null;
  readonly body: string;
}

function tagName(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision <= 0) {
    throw new Error("INVALID_MERGE_JOURNAL_REVISION");
  }
  return `delivery-control/r${revision}`;
}

function headers(repositoryToken: string): Record<string, string> {
  if (!repositoryToken.trim()) {
    throw new Error("MERGE_JOURNAL_CREDENTIAL_MISSING");
  }
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${repositoryToken}`,
    "content-type": "application/json",
    "x-github-api-version": "2026-03-10",
  };
}

export async function readMergeJournalRevision(input: {
  readonly repositoryToken: string;
  readonly revision: number;
  readonly fetchImpl?: FetchLike;
}): Promise<(MergeJournalPosition & MergeJournalPayload) | null> {
  const name = tagName(input.revision);
  const fetchImpl = input.fetchImpl ?? fetch;
  const options = { headers: headers(input.repositoryToken) };
  const refResponse = await fetchImpl(`${gitApi}/ref/tags/${name}`, options);
  if (refResponse.status === 404) {
    return null;
  }
  if (refResponse.status !== 200) {
    throw new Error("MERGE_JOURNAL_REFERENCE_UNAVAILABLE");
  }
  const ref = (await refResponse.json()) as TagReference;
  const sha = ref.object?.sha;
  if (
    ref.ref !== `refs/tags/${name}` ||
    ref.object?.type !== "tag" ||
    !sha ||
    !oid.test(sha)
  ) {
    throw new Error("MERGE_JOURNAL_REFERENCE_UNVERIFIED");
  }
  const tagResponse = await fetchImpl(`${gitApi}/tags/${sha}`, options);
  if (tagResponse.status !== 200) {
    throw new Error("MERGE_JOURNAL_TAG_UNAVAILABLE");
  }
  const tag = (await tagResponse.json()) as TagObject;
  if (
    tag.tag !== name ||
    tag.sha !== sha ||
    tag.object?.type !== "commit" ||
    !oid.test(tag.object.sha) ||
    typeof tag.message !== "string"
  ) {
    throw new Error("MERGE_JOURNAL_TAG_UNVERIFIED");
  }
  const payload = JSON.parse(
    tag.message,
  ) as Partial<MergeJournalPayload> | null;
  const previous = payload?.previous;
  if (
    payload?.revision !== input.revision ||
    (previous !== null &&
      (typeof previous !== "string" || !oid.test(previous))) ||
    (previous === null) !== (input.revision === 1) ||
    typeof payload.body !== "string" ||
    !payload.body
  ) {
    throw new Error("MERGE_JOURNAL_PAYLOAD_UNVERIFIED");
  }
  return {
    revision: input.revision,
    tagSha: sha,
    previous,
    body: payload.body,
  };
}

export type MergeJournalAppend =
  | { readonly status: "committed"; readonly position: MergeJournalPosition }
  | { readonly status: "not-confirmed" };

// The unique ref name is the compare-and-append boundary. Only a verified
// HTTP 201 for this creation authorizes this caller's next remote effect.
export async function appendMergeJournalRevision(input: {
  readonly repositoryToken: string;
  readonly previous: MergeJournalPosition | null;
  readonly candidateHeadSha: string;
  readonly body: string;
  readonly fetchImpl?: FetchLike;
}): Promise<MergeJournalAppend> {
  if (
    !oid.test(input.candidateHeadSha) ||
    !input.body ||
    (input.previous &&
      (!Number.isSafeInteger(input.previous.revision) ||
        input.previous.revision <= 0 ||
        !oid.test(input.previous.tagSha)))
  ) {
    throw new Error("INVALID_MERGE_JOURNAL_APPEND");
  }
  const revision = (input.previous?.revision ?? 0) + 1;
  const name = tagName(revision);
  const payload: MergeJournalPayload = {
    revision,
    previous: input.previous?.tagSha ?? null,
    body: input.body,
  };
  const message = JSON.stringify(payload);
  const requestHeaders = headers(input.repositoryToken);
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const objectResponse = await fetchImpl(`${gitApi}/tags`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        tag: name,
        message,
        object: input.candidateHeadSha,
        type: "commit",
      }),
    });
    if (objectResponse.status !== 201) {
      return { status: "not-confirmed" };
    }
    const object = (await objectResponse.json()) as TagObject;
    if (
      object.tag !== name ||
      object.message?.trimEnd() !== message ||
      !object.sha ||
      !oid.test(object.sha) ||
      object.object?.type !== "commit" ||
      object.object.sha !== input.candidateHeadSha
    ) {
      return { status: "not-confirmed" };
    }
    const ref = `refs/tags/${name}`;
    const refResponse = await fetchImpl(`${gitApi}/refs`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ ref, sha: object.sha }),
    });
    if (refResponse.status !== 201) {
      return { status: "not-confirmed" };
    }
    const created = (await refResponse.json()) as TagReference;
    if (
      created.ref !== ref ||
      created.object?.type !== "tag" ||
      created.object.sha !== object.sha
    ) {
      return { status: "not-confirmed" };
    }
    return { status: "committed", position: { revision, tagSha: object.sha } };
  } catch {
    return { status: "not-confirmed" };
  }
}
