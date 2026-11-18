import { expect, it, vi } from "vitest";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import type { ControlledWriteScope } from "../control/controlled-write.js";
import {
  authoringMetadataBeforeDigest,
  readAuthoringMetadataSnapshot,
  resolveAuthoringMetadataOperation,
} from "./authoring-metadata-operation.js";

const headSha = "a".repeat(40);
const baseSha = "b".repeat(40);
const fixture = {
  id: 523,
  node_id: "PR_fixture",
  number: 147,
  title: "Protected authoring",
  body: "Refs #140",
  state: "open",
  updated_at: "2026-11-18T12:00:00Z",
  draft: true,
  head: { sha: headSha, repo: { id: 1336937640 } },
  base: { sha: baseSha, ref: "main", repo: { id: 1336937640 } },
};
const authorization = {
  authorityDigest: "c".repeat(64),
  readAuthority: async () => "c".repeat(64),
  reserved: null,
  inventoryComplete: true,
  readToken: "fixture-read",
  authoringToken: "fixture-write",
};

async function makeRequest(
  kind: "edit-pull-request" | "edit-work",
  response: object,
): Promise<PreparedAuthoringRequest> {
  const command = {
    payloadDigest: "d".repeat(64),
    beforeStateDigest: "e".repeat(64),
  };
  const metadataCommand =
    kind === "edit-work"
      ? { ...command, kind }
      : { ...command, kind, headSha, baseSha, pullNumber: 147 };
  const request: PreparedAuthoringRequest = {
    schema: 1,
    repositoryId: 1336937640,
    workNumber: 140,
    requestId: "f".repeat(64),
    actorDigest: "1".repeat(64),
    commandDigest: "2".repeat(64),
    command: metadataCommand,
  };
  const snapshot = await readAuthoringMetadataSnapshot({
    request,
    ...authorization,
    fetchImpl: async () => Response.json(response),
  });
  if (!snapshot) {
    throw new Error("Invalid fixture");
  }
  return {
    ...request,
    command: {
      ...metadataCommand,
      beforeStateDigest: authoringMetadataBeforeDigest(snapshot),
    },
  };
}

function scope(kind: ControlledWriteScope["kind"]): ControlledWriteScope {
  return {
    repositoryId: 1336937640,
    kind,
    affectedWorks: [140],
    affectedPulls: [147],
    affectedRefs: [],
  };
}

it("requires an exact grant and positively observes the native draft transition", async () => {
  const request = await makeRequest("edit-pull-request", fixture);
  const fetchImpl = vi.fn<typeof fetch>();
  const input = {
    ...authorization,
    request,
    scope: scope("edit-pull-request"),
    fetchImpl,
    payload: Buffer.from(JSON.stringify({ draft: false })),
  };
  fetchImpl.mockResolvedValueOnce(Response.json(fixture));
  await expect(resolveAuthoringMetadataOperation(input)).resolves.toBeNull();
  expect(fetchImpl).toHaveBeenCalledTimes(1);

  fetchImpl
    .mockResolvedValueOnce(Response.json(fixture))
    .mockResolvedValueOnce(Response.json(fixture))
    .mockResolvedValueOnce(Response.json({ data: {} }))
    .mockResolvedValueOnce(Response.json({ ...fixture, draft: false }));
  const operation = await resolveAuthoringMetadataOperation({
    ...input,
    allowExactMetadataChange: true,
  });
  await expect(operation?.perform(async () => true)).resolves.toMatchObject({
    outcome: "confirmed",
  });
  const write = fetchImpl.mock.calls.find(
    ([, options]) => options?.method === "POST",
  );
  expect(write?.[0]).toBe("https://api.github.com/graphql");
  expect(write?.[1]?.body).toContain("markPullRequestReadyForReview");
  expect(write?.[1]?.body).toContain("PR_fixture");
});

it("binds Work labels to the observed prior and next state", async () => {
  const issue = {
    ...fixture,
    head: undefined,
    base: undefined,
    number: 140,
    repository_url: "https://api.github.com/repos/Oxelio/architecture-web",
    labels: [{ name: "char:privacy" }],
  };
  const request = await makeRequest("edit-work", issue);
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(issue))
    .mockResolvedValueOnce(Response.json(issue))
    .mockResolvedValueOnce(Response.json(issue))
    .mockResolvedValueOnce(Response.json(issue));
  const operation = await resolveAuthoringMetadataOperation({
    ...authorization,
    request,
    scope: scope("edit-work"),
    fetchImpl,
    allowExactMetadataChange: true,
    payload: Buffer.from(JSON.stringify({ labels: ["char:security"] })),
  });
  await expect(operation?.perform(async () => true)).resolves.toBeNull();
  expect(fetchImpl.mock.calls[2]?.[1]).toMatchObject({
    method: "PATCH",
    body: '{"labels":["char:security"]}',
  });
});
