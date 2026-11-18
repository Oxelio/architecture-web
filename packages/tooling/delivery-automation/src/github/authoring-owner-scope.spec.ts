import { createHash } from "node:crypto";

import { expect, it, vi } from "vitest";

import { prepareAuthoringRequest } from "../control/authoring-request.js";
import type { MergeReservation } from "../control/merge-reservation.js";
import { authoringMetadataBeforeDigest } from "./authoring-metadata-operation.js";
import { createAuthoringOperationResolver } from "./authoring-operation-resolver.js";
import { readAuthoringOwnerScope } from "./authoring-owner-scope.js";

const repo = "Oxelio/architecture-web";
const repositoryUrl = `https://api.github.com/repos/${repo}`;
const issue = (number: number) => ({ number, repository_url: repositoryUrl });
const pull = (number: number, work: number, ref = "codex/work-140") => ({
  number,
  body: `Refs #${work}`,
  head: { ref, repo: { id: 1336937640 } },
  base: { ref: "main", repo: { id: 1336937640 } },
});

function prepare(
  command: { kind?: string; [key: string]: unknown } = {},
  payload = Buffer.from('{"title":"updated title"}'),
) {
  const request = prepareAuthoringRequest({
    authenticatedSubject: "fixture",
    envelope: {
      schema: 1,
      repositoryId: 1336937640,
      workNumber: 140,
      clientKey: "11111111-1111-4111-8111-111111111111",
      command: {
        kind: "edit-work",
        ...(command.kind !== "publish-commit"
          ? { beforeStateDigest: "a".repeat(64) }
          : {}),
        payloadDigest: createHash("sha256").update(payload).digest("hex"),
        ...command,
      },
    },
  });
  if (!request) {
    throw new Error("Invalid fixture");
  }
  return { request, payload };
}

function fixture() {
  const state = {
    projectOpen: true,
    complete: true,
    joined: true,
    pulls: [pull(147, 140), pull(201, 210, "codex/work-210"), pull(203, 999)],
  };
  const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
    const path = new URL(String(url));
    expect(init?.method === undefined || path.pathname === "/graphql").toBe(
      true,
    );
    if (path.pathname === "/graphql") {
      return Response.json({
        data: {
          node: {
            __typename: "ProjectV2",
            items: {
              nodes: [
                {
                  id: "work-140",
                  isArchived: false,
                  content: {
                    __typename: "Issue",
                    number: 140,
                    state: state.projectOpen ? "OPEN" : "CLOSED",
                    repository: { nameWithOwner: repo },
                  },
                  fieldValues: { nodes: [], pageInfo: { hasNextPage: false } },
                },
              ],
              pageInfo: { hasNextPage: false },
            },
          },
        },
      });
    }
    if (path.pathname.endsWith("/pulls")) {
      if (path.searchParams.get("page") === "1") {
        return Response.json(state.pulls.slice(0, 1), {
          headers: { link: '<https://api.github.com/p2>; rel="next"' },
        });
      }
      return Response.json(state.pulls.slice(1));
    }
    if (path.pathname.endsWith("/issues/140")) {
      return Response.json({
        ...issue(140),
        id: 10140,
        title: "prior",
        body: null,
        state: "open",
        updated_at: "2026-11-18T10:30:00Z",
      });
    }
    const [, number, type] =
      /\/issues\/(\d+)\/(.+)$/u.exec(path.pathname) ?? [];
    if (type === "parent") {
      return number === "141"
        ? Response.json(issue(140))
        : new Response(null, { status: 404 });
    }
    if (
      !state.complete &&
      number === "140" &&
      type === "dependencies/blocking"
    ) {
      return new Response(null, { status: 503 });
    }
    if (number === "140" && type === "sub_issues") {
      return Response.json([issue(141)]);
    }
    if (state.joined && number === "141" && type === "dependencies/blocking") {
      return Response.json([issue(210)]);
    }
    if (
      state.joined &&
      number === "210" &&
      type === "dependencies/blocked_by"
    ) {
      return Response.json([issue(141)]);
    }
    return Response.json([]);
  });
  return {
    state,
    fetchImpl,
    input: {
      ...prepare(),
      reservation: null,
      repositoryReadToken: "fixture-reader",
      projectsReadToken: "fixture-projects",
      maximumRelatedIssues: 20,
      fetchImpl,
    },
  };
}

const reservation: MergeReservation = {
  candidate: {
    workNumber: 210,
    pullNumber: 201,
    headSha: "a".repeat(40),
    baseSha: "b".repeat(40),
  },
  state: { phase: "armed", checkId: 15 },
};

it("finds a reserved candidate through a paginated reverse dependency and a native child", async () => {
  const f = fixture();
  const result = await readAuthoringOwnerScope({ ...f.input, reservation });
  expect(result).toMatchObject({
    scope: {
      affectedWorks: [140, 141, 210],
      affectedPulls: [147, 201],
      affectedRefs: [],
    },
    reserved: {
      relevantWorks: [140, 141, 210],
      relevantPulls: [147, 201],
      relevantRefs: ["refs/heads/codex/work-210", "refs/heads/main"],
    },
  });
  expect(
    await readAuthoringOwnerScope({ ...f.input, maximumRelatedIssues: 2 }),
  ).toBeNull();
  f.state.complete = false;
  expect(await readAuthoringOwnerScope(f.input)).toBeNull();
});

it("includes shared source refs and rejects a PR ownership substitution", async () => {
  const f = fixture();
  const publish = prepare({
    kind: "publish-commit",
    sourceRef: "refs/heads/codex/work-140",
    expectedHeadSha: null,
    proposedHeadSha: "f".repeat(40),
  });
  expect(
    await readAuthoringOwnerScope({ ...f.input, ...publish }),
  ).toMatchObject({
    scope: {
      affectedPulls: [147, 201, 203],
      affectedRefs: ["refs/heads/codex/work-140"],
    },
  });
  const edit = {
    kind: "edit-pull-request",
    pullNumber: 147,
    headSha: "a".repeat(40),
    baseSha: "b".repeat(40),
  };
  expect(
    await readAuthoringOwnerScope({ ...f.input, ...prepare(edit) }),
  ).toMatchObject({ scope: { affectedPulls: [147, 201] } });
  expect(
    await readAuthoringOwnerScope({
      ...f.input,
      ...prepare(edit, Buffer.from('{"body":"Refs #210"}')),
    }),
  ).toBeNull();
});

it("includes both ends of a new dependency and preserves a merged reservation scope", async () => {
  const f = fixture();
  f.state.joined = false;
  f.state.pulls = [pull(147, 140)];
  const edit = prepare(
    { kind: "edit-task-dependency", taskNumber: 141 },
    Buffer.from('{"dependencyNumber":210}'),
  );
  expect(
    await readAuthoringOwnerScope({ ...f.input, ...edit, reservation }),
  ).toBeNull();
  expect(
    await readAuthoringOwnerScope({
      ...f.input,
      ...edit,
      reservation: { ...reservation, state: { phase: "cancelled" } },
    }),
  ).toMatchObject({
    scope: { affectedWorks: [140, 141, 210] },
    reserved: { relevantPulls: [201], relevantRefs: ["refs/heads/main"] },
  });
});

it("resolves a real metadata adapter and refuses handoff after the owner graph changes", async () => {
  const f = fixture();
  const readOwnerBinding = vi.fn().mockResolvedValue({
    authorityDigest: "a".repeat(64),
    readAuthority: async () => "a".repeat(64),
  });
  const configuration = {
    readToken: "fixture-reader",
    authoringToken: "fixture-author",
    projectsReadToken: "fixture-projects",
    projectsWriteToken: "fixture-project-write",
    statusWriter: { readStatus: vi.fn(), writeStatus: vi.fn() },
    statusFieldId: "status",
    authoringAppId: 3,
    authoringBotId: 4,
    stagingDirectory: "/unused",
    maximumCommits: 20,
    maximumRelatedIssues: 20,
    fetchImpl: f.fetchImpl,
    readOwnerBinding,
  };
  const resolve = createAuthoringOperationResolver(configuration);
  const request = prepare({
    beforeStateDigest: authoringMetadataBeforeDigest({
      id: 10140,
      number: 140,
      title: "prior",
      body: null,
      state: "open",
      updatedAt: "2026-11-18T10:30:00Z",
      draft: null,
      headSha: null,
      baseSha: null,
    }),
  });
  const boundary = {
    position: null,
    reservation: null,
    projectStatus: null,
    authoring: [],
  };
  const operation = await resolve(request.request, request.payload, boundary);
  expect(operation).not.toBeNull();
  expect(await operation?.isCurrent()).toBe(true);
  f.state.joined = false;
  expect(await operation?.isCurrent()).toBe(false);
  f.state.projectOpen = false;
  expect(await resolve(request.request, request.payload, boundary)).toBeNull();
  readOwnerBinding.mockResolvedValue(null);
  expect(await resolve(request.request, request.payload, boundary)).toBeNull();
  expect(() =>
    createAuthoringOperationResolver({
      ...configuration,
      authoringToken: configuration.readToken,
    }),
  ).toThrow("AUTHORING_CREDENTIALS_UNVERIFIED");
});
