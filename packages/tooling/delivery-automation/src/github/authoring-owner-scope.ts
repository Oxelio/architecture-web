import { z } from "zod";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import {
  type ControlledWriteScope,
  isControlledBranchRef,
  type ReservedWriteContext,
} from "../control/controlled-write.js";
import type { MergeReservation } from "../control/merge-reservation.js";
import { readProjectWorkItems } from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";
import { workReferences } from "./work-reference.js";

const repository = "Oxelio/architecture-web";
const endpoint = `https://api.github.com/repos/${repository}`;
const projectId = "PVT_kwHOBPzbjc4Bgts6";
const id = z.number().int().positive().safe();
const issue = z.object({
  number: id,
  repository_url: z.literal(endpoint),
  pull_request: z.undefined().optional(),
});
const pull = z.object({
  number: id,
  body: z.string().nullable(),
  head: z.object({ ref: z.string(), repo: z.object({ id }).nullable() }),
  base: z.object({
    ref: z.string(),
    repo: z.object({ id: z.literal(1336937640) }),
  }),
});
type Pull = z.infer<typeof pull>;

interface ScopeInput {
  readonly request: PreparedAuthoringRequest;
  readonly payload: Uint8Array;
  readonly reservation: MergeReservation | null;
  readonly repositoryReadToken: string;
  readonly projectsReadToken: string;
  readonly maximumRelatedIssues: number;
  readonly fetchImpl?: FetchLike;
}

function get(input: ScopeInput, path: string) {
  return (input.fetchImpl ?? fetch)(`${endpoint}${path}`, {
    headers: {
      Authorization: `Bearer ${input.repositoryReadToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
}

async function list<T extends z.ZodType>(
  input: ScopeInput,
  path: string,
  schema: T,
): Promise<z.infer<T>[]> {
  const results: z.infer<T>[] = [];
  const separator = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= 20; page++) {
    const response = await get(
      input,
      `${path}${separator}per_page=100&page=${page}`,
    );
    if (response.status !== 200) {
      throw new Error("AUTHORING_SCOPE_UNAVAILABLE");
    }
    results.push(...z.array(schema).parse(await response.json()));
    if (!response.headers.get("link")?.includes('rel="next"')) {
      return results;
    }
  }
  throw new Error("AUTHORING_SCOPE_INCOMPLETE");
}

async function adjacentIssues(input: ScopeInput, number: number) {
  const paths = [
    "dependencies/blocked_by",
    "dependencies/blocking",
    "sub_issues",
  ];
  const [parent, ...related] = await Promise.all([
    get(input, `/issues/${number}/parent`),
    ...paths.map((path) => list(input, `/issues/${number}/${path}`, issue)),
  ] as const);
  if (parent.status !== 200 && parent.status !== 404) {
    throw new Error("AUTHORING_SCOPE_UNAVAILABLE");
  }
  const parentNumber =
    parent.status === 200 ? [issue.parse(await parent.json()).number] : [];
  return [...parentNumber, ...related.flat().map((value) => value.number)];
}

async function relatedIssues(
  input: ScopeInput,
  seeds: readonly number[],
  cache: Map<number, number[]>,
) {
  const pending = new Set(seeds);
  const visited = new Set<number>();
  for (const number of pending) {
    if (visited.size >= input.maximumRelatedIssues) {
      throw new Error("AUTHORING_SCOPE_INCOMPLETE");
    }
    visited.add(number);
    const adjacent = cache.get(number) ?? (await adjacentIssues(input, number));
    cache.set(number, adjacent);
    for (const next of adjacent) {
      pending.add(next);
    }
  }
  return visited;
}

function operationSeeds(input: ScopeInput, pulls: readonly Pull[]) {
  const { request } = input;
  const command = request.command;
  const issues = [request.workNumber];
  const refs: string[] = [];
  const pullNumbers: number[] = [];
  if (
    command.kind === "publish-commit" ||
    command.kind === "create-pull-request"
  ) {
    refs.push(command.sourceRef);
  }
  if (command.kind === "edit-pull-request") {
    const current = pulls.find((value) => value.number === command.pullNumber);
    if (current?.head.repo?.id !== 1336937640 || current.base.ref !== "main") {
      throw new Error("AUTHORING_SCOPE_UNVERIFIED");
    }
    const edit = z
      .object({ body: z.string().optional() })
      .parse(
        JSON.parse(Buffer.from(input.payload).toString("utf8")) as unknown,
      );
    const owners = workReferences(current.body);
    const proposedOwners = workReferences(edit.body ?? current.body);
    // Ordinary title/body editing preserves the existing owning Work binding.
    // Reassignment has separate authority and cannot be implied by text.
    if (
      owners.length !== 1 ||
      owners[0] !== request.workNumber ||
      proposedOwners.length !== 1 ||
      proposedOwners[0] !== request.workNumber
    ) {
      throw new Error("AUTHORING_SCOPE_UNVERIFIED");
    }
    pullNumbers.push(command.pullNumber);
  }
  if (command.kind === "edit-task-dependency") {
    const dependency = z
      .object({ dependencyNumber: id })
      .parse(
        JSON.parse(Buffer.from(input.payload).toString("utf8")) as unknown,
      );
    issues.push(command.taskNumber, dependency.dependencyNumber);
  }
  return { issues, refs, pullNumbers };
}

function relevantPulls(
  pulls: readonly Pull[],
  issues: ReadonlySet<number>,
  refs: readonly string[],
  requiredPulls: readonly number[],
) {
  const matched = pulls.filter(
    (value) =>
      value.head.repo?.id === 1336937640 &&
      (requiredPulls.includes(value.number) ||
        refs.includes(`refs/heads/${value.head.ref}`) ||
        workReferences(value.body).some((number) => issues.has(number))),
  );
  for (const number of requiredPulls) {
    if (!matched.some((value) => value.number === number)) {
      throw new Error("AUTHORING_SCOPE_UNVERIFIED");
    }
  }
  return matched;
}

export async function readAuthoringOwnerScope(input: ScopeInput): Promise<{
  readonly scope: ControlledWriteScope;
  readonly reserved: ReservedWriteContext | null;
} | null> {
  if (
    !input.repositoryReadToken ||
    !input.projectsReadToken ||
    !Number.isSafeInteger(input.maximumRelatedIssues) ||
    input.maximumRelatedIssues < 1
  ) {
    return null;
  }
  try {
    const [works, pulls] = await Promise.all([
      readProjectWorkItems({
        repository,
        projectId,
        projectsToken: input.projectsReadToken,
        ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
      }),
      list(input, "/pulls?state=open", pull),
    ]);
    if (
      !works.some(
        (work) =>
          work.issueOpen && work.issueNumber === input.request.workNumber,
      ) ||
      new Set(pulls.map((value) => value.number)).size !== pulls.length
    ) {
      return null;
    }
    const cache = new Map<number, number[]>();
    const seeds = operationSeeds(input, pulls);
    const affected = await relatedIssues(input, seeds.issues, cache);
    const affectedPulls = relevantPulls(
      pulls,
      affected,
      seeds.refs,
      seeds.pullNumbers,
    );
    if (!seeds.refs.every(isControlledBranchRef)) {
      return null;
    }
    const scope: ControlledWriteScope = {
      repositoryId: 1336937640,
      kind: input.request.command.kind,
      affectedWorks: [...affected].sort((a, b) => a - b),
      affectedPulls: affectedPulls
        .map((value) => value.number)
        .sort((a, b) => a - b),
      affectedRefs: seeds.refs,
    };
    const reserved = input.reservation
      ? await reservedScope(input, input.reservation, pulls, cache)
      : null;
    return !input.reservation || reserved ? { scope, reserved } : null;
  } catch {
    return null;
  }
}

async function reservedScope(
  input: ScopeInput,
  reservation: MergeReservation,
  pulls: readonly Pull[],
  cache: Map<number, number[]>,
): Promise<ReservedWriteContext | null> {
  const { workNumber, pullNumber } = reservation.candidate;
  const owners = await relatedIssues(input, [workNumber], cache);
  const current = pulls.find((value) => value.number === pullNumber);
  if (!current) {
    // A terminal merge no longer appears in the open list. Preserve the known
    // Work/PR scope so a related write still reaches the recovery branch.
    if (
      !["merged", "cancelled", "invalidated"].includes(reservation.state.phase)
    ) {
      return null;
    }
    return {
      reservation,
      relevantWorks: [...owners],
      relevantPulls: [pullNumber],
      relevantRefs: ["refs/heads/main"],
    };
  }
  const source = `refs/heads/${current.head.ref}`;
  if (
    !isControlledBranchRef(source) ||
    current.base.ref !== "main" ||
    current.head.repo?.id !== 1336937640
  ) {
    return null;
  }
  return {
    reservation,
    relevantWorks: [...owners].sort((a, b) => a - b),
    relevantPulls: relevantPulls(pulls, owners, [source], [pullNumber])
      .map((value) => value.number)
      .sort((a, b) => a - b),
    relevantRefs: [source, "refs/heads/main"],
  };
}
