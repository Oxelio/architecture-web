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

type MergeJournalEntry = MergeJournalPosition &
  MergeJournalPayload & {
    readonly candidateHeadSha: string;
  };

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
}): Promise<MergeJournalEntry | null> {
  const name = tagName(input.revision);
  const fetchImpl = input.fetchImpl ?? fetch;
  const options = {
    redirect: "error",
    headers: headers(input.repositoryToken),
  } as const;
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
    candidateHeadSha: tag.object.sha,
    body: payload.body,
  };
}

// Concurrent discovery may see an older tail. Only the create-only append
// can grant a subsequent remote effect, so a stale reader cannot act.
export async function readMergeJournalTail(input: {
  readonly repositoryToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<MergeJournalEntry | null> {
  const response = await (input.fetchImpl ?? fetch)(
    `${gitApi}/matching-refs/tags/delivery-control/r`,
    { redirect: "error", headers: headers(input.repositoryToken) },
  );
  if (response.status !== 200 || response.headers.has("link")) {
    throw new Error("MERGE_JOURNAL_INVENTORY_UNAVAILABLE");
  }
  const matches: unknown = await response.json();
  if (!Array.isArray(matches)) {
    throw new Error("MERGE_JOURNAL_INVENTORY_UNVERIFIED");
  }

  const tags = new Map<number, string>();
  for (const ref of matches as readonly (TagReference | null)[]) {
    const revision = Number(
      ref?.ref?.match(/^refs\/tags\/delivery-control\/r([1-9]\d*)$/u)?.[1],
    );
    const sha = ref?.object?.sha;
    if (
      !Number.isSafeInteger(revision) ||
      revision > matches.length ||
      tags.has(revision) ||
      ref?.object?.type !== "tag" ||
      !sha ||
      !oid.test(sha)
    ) {
      throw new Error("MERGE_JOURNAL_INVENTORY_UNVERIFIED");
    }
    tags.set(revision, sha);
  }
  if (!tags.size) {
    return null;
  }

  const tail = await readMergeJournalRevision({
    ...input,
    revision: tags.size,
  });
  if (
    !tail ||
    tail.tagSha !== tags.get(tags.size) ||
    tail.previous !== (tags.get(tags.size - 1) ?? null)
  ) {
    throw new Error("MERGE_JOURNAL_TAIL_UNVERIFIED");
  }
  return tail;
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
      redirect: "error",
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
      redirect: "error",
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
