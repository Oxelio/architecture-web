import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type JsonRecord = Record<string, unknown>;

export interface QualityInputs {
  event: string | undefined;
  validation: string | undefined;
  dependencyReview: string | undefined;
  commitlint: string | undefined;
  mode?: string | undefined;
  evidence?: { verified: boolean } | undefined;
}

type AcceptQuality = (inputs: QualityInputs) => boolean;
type ValidationResults = Pick<QualityInputs, "validation" | "dependencyReview">;
type Route = "full" | "metadata";

export interface EvidenceApi {
  request(path: string): Promise<unknown>;
  pages(path: string, key: string): Promise<unknown[]>;
  artifact(id: number, digest: string | undefined): Promise<unknown>;
}

interface CandidateIdentity {
  repositoryId: number;
  repository: string;
  pr: number;
  headRepositoryId: number;
  headRepository: string;
  head: string;
  baseRef: "main";
  base: string;
  candidate: string;
}

interface IdentityOptions {
  env: NodeJS.ProcessEnv;
  payload: unknown;
  checkout: string;
  parents: string[];
  now?: number;
}

interface ResolveEvidenceOptions {
  api: EvidenceApi;
  identity: CandidateIdentity;
  runId: number;
  now?: number;
}

interface VerifyIdentityOptions {
  identity: CandidateIdentity;
  source: unknown;
  job: string;
  artifact: unknown;
  now: number;
}

interface EvaluatePrOptions {
  api: EvidenceApi;
  identity: CandidateIdentity;
  mode: string;
  results: ValidationResults;
  lint: (title: string) => boolean;
  runId: number;
  accept: AcceptQuality;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown): JsonRecord {
  check(isRecord(value), "Invalid GitHub evidence object");
  return value;
}

function optionalObject(value: unknown): JsonRecord {
  return value === null || value === undefined ? {} : object(value);
}

function objects(value: unknown): JsonRecord[] {
  check(Array.isArray(value), "Invalid GitHub evidence inventory");
  const items: unknown[] = value;
  return items.map(object);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
}

export const EVIDENCE_DAYS = 7;
const lifetime = EVIDENCE_DAYS * 86400000;
const caller = ".github/workflows/delivery-automation-validation.yml";
const reusable = ".github/workflows/repository-validation.yml";
// CI uses Ubuntu system tools. Local Windows verification uses Git for Windows.
const git =
  process.platform === "win32"
    ? "C:/Program Files/Git/cmd/git.exe"
    : "/usr/bin/git";
const unzip =
  process.platform === "win32"
    ? "C:/Program Files/Git/usr/bin/unzip.exe"
    : "/usr/bin/unzip";
const commitlint = fileURLToPath(
  new URL("../node_modules/@commitlint/cli/cli.js", import.meta.url),
);
const validationJobs = {
  primary: "validate / Validate repository and delivery tooling",
  node24: "validate / Node 24 compatibility",
};
function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function validationRoute(
  event: string | undefined,
  input: unknown,
): Route {
  const payload = object(input);
  const changes = Object.keys(payload.changes ?? {});
  return event === "pull_request" &&
    payload.action === "edited" &&
    changes.length > 0 &&
    changes.every((key) => ["title", "body"].includes(key))
    ? "metadata"
    : "full";
}

export function candidateIdentity(
  input: unknown,
  candidate: unknown,
): CandidateIdentity {
  const payload = object(input);
  const repository = optionalObject(payload.repository);
  const pr = optionalObject(payload.pull_request);
  const head = optionalObject(pr.head);
  const headRepository = optionalObject(head.repo);
  const base = optionalObject(pr.base);
  check(
    isSha(head.sha) &&
      isSha(base.sha) &&
      isSha(candidate) &&
      positiveInteger(repository.id) &&
      positiveInteger(headRepository.id) &&
      positiveInteger(pr.number) &&
      typeof repository.full_name === "string" &&
      typeof headRepository.full_name === "string" &&
      base.ref === "main",
    "Incomplete PR candidate identity",
  );
  return {
    repositoryId: repository.id,
    repository: repository.full_name,
    pr: pr.number,
    headRepositoryId: headRepository.id,
    headRepository: headRepository.full_name,
    head: head.sha,
    baseRef: base.ref,
    base: base.sha,
    candidate,
  };
}

export function createIdentity({
  env,
  payload,
  checkout,
  parents,
  now = Date.now(),
}: IdentityOptions) {
  const identity = candidateIdentity(payload, env.CANDIDATE_SHA);
  check(
    checkout === identity.candidate &&
      env.GITHUB_SHA === identity.candidate &&
      env.COMPARISON_BASE === identity.base &&
      env.GITHUB_WORKFLOW_SHA === identity.candidate &&
      env.GITHUB_WORKFLOW_REF ===
        `${identity.repository}/${caller}@refs/pull/${identity.pr}/merge` &&
      typeof env.VALIDATION_JOB === "string" &&
      Object.hasOwn(validationJobs, env.VALIDATION_JOB),
    "Actual inputs/checkout do not match the PR candidate",
  );
  if (env.VALIDATION_JOB === "primary") {
    check(
      JSON.stringify(parents) ===
        JSON.stringify([identity.base, identity.head]),
      "Merge candidate parents do not match base and head",
    );
  }
  const runId = Number(env.GITHUB_RUN_ID),
    attempt = Number(env.GITHUB_RUN_ATTEMPT);
  check(
    [runId, attempt].every((id) => Number.isSafeInteger(id) && id > 0),
    "Invalid run/attempt identity",
  );
  return {
    version: 1,
    identity,
    candidateInput: env.CANDIDATE_SHA,
    comparisonBaseInput: env.COMPARISON_BASE,
    checkout,
    workflowRef: env.GITHUB_WORKFLOW_REF,
    workflowSha: env.GITHUB_WORKFLOW_SHA,
    runId,
    attempt,
    job: env.VALIDATION_JOB,
    createdAt: new Date(now).toISOString(),
  };
}

export function githubClient(
  repository: string | undefined,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): EvidenceApi {
  check(
    typeof repository === "string" &&
      /^[\w.-]+\/[\w.-]+$/u.test(repository) &&
      Boolean(token),
    "Read-only GitHub access is unavailable",
  );
  const root = `https://api.github.com/repos/${repository}`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2026-03-10",
  };
  async function request(path: string): Promise<unknown> {
    check(path.startsWith("/") && !path.includes(".."), "Invalid API path");
    const response = await fetchImpl(`${root}${path}`, {
      headers,
      signal: AbortSignal.timeout(30000),
      redirect: "manual",
    });
    check(response.ok, `GitHub evidence read failed: HTTP ${response.status}`);
    return response.json();
  }
  async function pages(path: string, key: string): Promise<unknown[]> {
    const items: unknown[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const response = object(
        await request(
          `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
        ),
      );
      const pageItems = response[key];
      check(Array.isArray(pageItems), "Incomplete paginated evidence");
      items.push(...pageItems);
      if (pageItems.length < 100) {
        check(
          Number.isSafeInteger(response.total_count) &&
            response.total_count === items.length,
          "Truncated or changing evidence inventory",
        );
        return items;
      }
    }
    throw new Error("Evidence pagination limit exceeded");
  }
  async function artifact(
    id: number,
    digest: string | undefined,
  ): Promise<unknown> {
    check(
      /^sha256:[a-f0-9]{64}$/u.test(digest ?? ""),
      "Missing artifact digest",
    );
    const redirect = await fetchImpl(`${root}/actions/artifacts/${id}/zip`, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    const target = new URL(
      redirect.headers.get("location") ?? "https://invalid.invalid",
    );
    check(
      redirect.status === 302 &&
        target.protocol === "https:" &&
        [
          ".blob.core.windows.net",
          ".actions.githubusercontent.com",
          ".githubusercontent.com",
        ].some((suffix) => target.hostname.endsWith(suffix)),
      "Invalid artifact download location",
    );
    // Never forward the GitHub credential to the signed storage endpoint.
    const response = await fetchImpl(target, {
      signal: AbortSignal.timeout(30000),
    });
    check(response.ok, `Artifact download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    check(bytes.length <= 65536, "Identity artifact is too large");
    check(
      `sha256:${createHash("sha256").update(bytes).digest("hex")}` === digest,
      "Identity artifact digest mismatch",
    );
    const directory = mkdtempSync(join(tmpdir(), "pr-validation-identity-"));
    try {
      const archive = join(directory, "identity.zip");
      writeFileSync(archive, bytes);
      check(
        execFileSync(unzip, ["-Z1", archive], {
          encoding: "utf8",
          maxBuffer: 65536,
        }).trim() === "identity.json",
        "Unexpected identity artifact contents",
      );
      return JSON.parse(
        execFileSync(unzip, ["-p", archive, "identity.json"], {
          encoding: "utf8",
          maxBuffer: 65536,
        }),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  return { request, pages, artifact };
}

function fresh(timestamp: unknown, now: number) {
  if (typeof timestamp !== "string") {
    return false;
  }
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= lifetime;
}
export function verifyIdentity(
  input: unknown,
  {
    identity,
    source: sourceInput,
    job,
    artifact: artifactInput,
    now,
  }: VerifyIdentityOptions,
) {
  const record = object(input);
  const source = object(sourceInput);
  const artifact = object(artifactInput);
  const workflowRun = optionalObject(artifact.workflow_run);
  check(
    record.version === 1 &&
      JSON.stringify(record.identity) === JSON.stringify(identity) &&
      record.candidateInput === identity.candidate &&
      record.comparisonBaseInput === identity.base &&
      record.checkout === identity.candidate &&
      record.workflowSha === identity.candidate &&
      record.workflowRef ===
        `${identity.repository}/${caller}@refs/pull/${identity.pr}/merge` &&
      record.runId === source.id &&
      record.attempt === source.run_attempt &&
      record.job === job &&
      fresh(record.createdAt, now) &&
      artifact.expired === false &&
      fresh(artifact.created_at, now) &&
      typeof artifact.expires_at === "string" &&
      Date.parse(artifact.expires_at) > now &&
      workflowRun.id === source.id &&
      workflowRun.repository_id === identity.repositoryId &&
      workflowRun.head_repository_id === identity.headRepositoryId &&
      workflowRun.head_sha === identity.head,
    "Identity artifact does not prove this candidate/run/attempt or has expired",
  );
}

export async function resolveEvidence({
  api,
  identity,
  runId,
  now = Date.now(),
}: ResolveEvidenceOptions) {
  const current = object(await api.request(`/actions/runs/${runId}`));
  const runs = await api.pages(
    `/actions/runs?event=pull_request&head_sha=${identity.head}`,
    "workflow_runs",
  );
  const relevant = (items: unknown[]) => {
    const matching = items
      .map(object)
      .filter(
        (run) =>
          run.id !== runId &&
          run.workflow_id === current.workflow_id &&
          ["full", "metadata"].some(
            (mode) =>
              run.display_title ===
              `Repository CI [${mode}] PR #${identity.pr}`,
          ),
      );
    return matching.map(
      (run): JsonRecord & { id: number; run_number: number } => {
        const { id, run_number: runNumber } = run;
        check(
          positiveInteger(id) && positiveInteger(runNumber),
          "Invalid validation run identity",
        );
        return { ...run, id, run_number: runNumber };
      },
    );
  };
  const sources = relevant(runs);
  sources.sort((a, b) => b.run_number - a.run_number);
  const original = sources.find(
    (run) => run.display_title === `Repository CI [full] PR #${identity.pr}`,
  );
  check(
    original,
    "No original full PR validation evidence; run full PR validation",
  );
  // A title/body edit plus an unknown field may have a metadata discovery name
  // but actually execute full validation. Never search past that newer run.
  const newer = await Promise.all(
    sources
      .filter((run) => run.run_number > original.run_number)
      .map(async (run) => {
        check(
          run.status === "completed" && positiveInteger(run.run_attempt),
          "Newer validation route is pending or unavailable",
        );
        const jobs = (
          await api.pages(
            `/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`,
            "jobs",
          )
        ).map(object);
        const routes = jobs.filter(
          (job) => job.name === "Select validation route",
        );
        const route = routes[0];
        check(
          routes.length === 1 &&
            route !== undefined &&
            route.run_id === run.id &&
            route.head_sha === identity.head &&
            route.status === "completed" &&
            route.conclusion === "success",
          "Newer validation route is unverified",
        );
        const modes = ["full", "metadata"].filter((mode) =>
          objects(route.steps ?? []).some(
            (step) =>
              step.name === `Selected validation route (${mode})` &&
              step.conclusion === "success",
          ),
        );
        check(modes.length === 1, "Newer validation route is unverified");
        return { run, mode: modes[0] };
      }),
  );
  const source = newer.find((item) => item.mode === "full")?.run ?? original;
  check(
    source.event === "pull_request" &&
      source.path === caller &&
      optionalObject(source.repository).id === identity.repositoryId &&
      optionalObject(source.repository).full_name === identity.repository &&
      optionalObject(source.head_repository).id === identity.headRepositoryId &&
      source.head_sha === identity.head &&
      source.status === "completed" &&
      source.conclusion === "success" &&
      positiveInteger(source.id) &&
      positiveInteger(source.run_attempt) &&
      objects(source.referenced_workflows ?? []).some(
        (workflow) =>
          workflow.path ===
            `${identity.repository}/${reusable}@${identity.candidate}` &&
          workflow.sha === identity.candidate &&
          workflow.ref === `refs/pull/${identity.pr}/merge`,
      ),
    "Newest full validation is unsuccessful, pending, or bound to another candidate",
  );
  const sourceAttempt = source.run_attempt;
  const jobs = (
    await api.pages(
      `/actions/runs/${source.id}/attempts/${sourceAttempt}/jobs`,
      "jobs",
    )
  ).map(object);
  const artifacts = (
    await api.pages(`/actions/runs/${source.id}/artifacts`, "artifacts")
  ).map(object);
  await Promise.all(
    [
      ...Object.values(validationJobs),
      "Dependency review",
      "Quality checks",
    ].map(async (name) => {
      const matches = jobs.filter((job) => job.name === name);
      check(matches.length === 1, `Missing or ambiguous source job: ${name}`);
      const job = matches[0];
      const prefix = `https://api.github.com/repos/${identity.repository}/check-runs/`;
      check(
        job !== undefined &&
          job.run_id === source.id &&
          job.head_sha === identity.head &&
          job.status === "completed" &&
          job.conclusion === "success" &&
          typeof job.check_run_url === "string" &&
          job.check_run_url.startsWith(prefix) &&
          /^\d+$/u.test(job.check_run_url.slice(prefix.length)),
        `Source job did not succeed: ${name}`,
      );
      const result = object(
        await api.request(
          `/check-runs/${job.check_run_url.slice(prefix.length)}`,
        ),
      );
      check(
        result.name === name &&
          optionalObject(result.app).id === 15368 &&
          optionalObject(result.check_suite).id === source.check_suite_id &&
          result.head_sha === identity.head &&
          result.status === "completed" &&
          result.conclusion === "success",
        `Source check provenance mismatch: ${name}`,
      );
    }),
  );
  await Promise.all(
    Object.entries(validationJobs).map(async ([job, name]) => {
      const steps = objects(
        jobs.find((item) => item.name === name)?.steps ?? [],
      );
      const recordStep = steps.findIndex(
        (step) =>
          step.name === "Record PR validation identity" &&
          step.conclusion === "success",
      );
      const uploadStep = steps.findIndex(
        (step) =>
          step.name === "Publish PR validation identity" &&
          step.conclusion === "success",
      );
      const installStep = steps.findIndex(
        (step) => step.name === "Install locked dependencies",
      );
      check(
        recordStep >= 0 && uploadStep > recordStep && installStep > uploadStep,
        "Source identity was not published before candidate installation",
      );
      const matches = artifacts.filter(
        (item) =>
          item.name === `pr-validation-identity-${sourceAttempt}-${job}`,
      );
      check(
        matches.length === 1,
        "Missing or ambiguous source identity artifact",
      );
      const artifact = matches[0];
      check(
        artifact !== undefined &&
          positiveInteger(artifact.id) &&
          typeof artifact.size_in_bytes === "number" &&
          artifact.size_in_bytes <= 65536 &&
          artifact.expired === false,
        "Unavailable identity artifact",
      );
      const digest =
        typeof artifact.digest === "string" ? artifact.digest : undefined;
      verifyIdentity(await api.artifact(artifact.id, digest), {
        identity,
        source,
        job,
        artifact,
        now,
      });
    }),
  );
  const latest = object(await api.request(`/actions/runs/${source.id}`));
  check(
    latest.run_attempt === sourceAttempt &&
      latest.status === "completed" &&
      latest.conclusion === "success",
    "Source attempt changed during evidence verification",
  );
  const refreshed = await api.pages(
    `/actions/runs?event=pull_request&head_sha=${identity.head}`,
    "workflow_runs",
  );
  check(
    !relevant(refreshed).some(
      (run) =>
        run.run_number > source.run_number &&
        !sources.some(
          (previous) =>
            previous.id === run.id && previous.run_attempt === run.run_attempt,
        ),
    ),
    "Newer full validation or metadata verification started during evidence verification",
  );
  check(typeof source.html_url === "string", "Missing source validation URL");
  return {
    verified: true,
    runId: source.id,
    attempt: sourceAttempt,
    url: source.html_url,
  };
}

export function assertLiveCandidate(
  input: unknown,
  identity: CandidateIdentity,
  candidate: unknown,
) {
  const pr = object(input);
  const actual = candidateIdentity(
    {
      repository: { id: identity.repositoryId, full_name: identity.repository },
      pull_request: pr,
    },
    candidate,
  );
  check(
    pr.state === "open" && JSON.stringify(actual) === JSON.stringify(identity),
    "Live PR candidate/base changed or is unavailable",
  );
}

async function readLivePr(api: EvidenceApi, identity: CandidateIdentity) {
  const pr = object(await api.request(`/pulls/${identity.pr}`));
  // REST 2026-03-10 removes merge_commit_sha from PR responses. Read the
  // actual synthetic merge ref instead of inferring a candidate from the head.
  const merge = object(await api.request(`/git/ref/pull/${identity.pr}/merge`));
  const mergeObject = optionalObject(merge.object);
  check(
    merge.ref === `refs/pull/${identity.pr}/merge` &&
      mergeObject.type === "commit",
    "Live PR merge reference is unavailable or invalid",
  );
  assertLiveCandidate(pr, identity, mergeObject.sha);
  return pr;
}

export async function evaluatePr({
  api,
  identity,
  mode,
  results,
  lint,
  runId,
  accept,
}: EvaluatePrOptions) {
  const before = await readLivePr(api, identity);
  check(
    typeof before.title === "string" && lint(before.title),
    "Current PR title failed commitlint",
  );
  const evidence =
    mode === "metadata"
      ? await resolveEvidence({ api, identity, runId })
      : undefined;
  check(
    accept({
      event: "pull_request",
      ...results,
      mode,
      evidence,
      commitlint: "success",
    }),
    "Required repository validation did not succeed",
  );
  const after = await readLivePr(api, identity);
  check(
    after.title === before.title,
    "PR title changed during final verification",
  );
  return { identity, mode, evidence };
}

export function lintTitle(title: string) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !["GITHUB_TOKEN", "GH_TOKEN", "SONAR_TOKEN"].includes(name),
    ),
  );
  const result = spawnSync(process.execPath, [commitlint], {
    input: `${title}\n`,
    encoding: "utf8",
    env,
  });
  // commitlint echoes the untrusted title; expose only its exit result to Actions.
  return result.status === 0 && !result.error;
}

export async function runQualityCli(
  accept: AcceptQuality,
  env: NodeJS.ProcessEnv = process.env,
  command = process.argv[2],
) {
  const payload: unknown = env.GITHUB_EVENT_PATH
    ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"))
    : {};
  if (command === "route") {
    check(env.GITHUB_OUTPUT, "Missing route output path");
    appendFileSync(
      env.GITHUB_OUTPUT,
      `mode=${validationRoute(env.GITHUB_EVENT_NAME, payload)}\n`,
    );
    return;
  }
  if (command === "identity") {
    const record = createIdentity({
      env,
      payload,
      checkout: execFileSync(git, ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      parents: execFileSync(git, ["show", "-s", "--format=%P", "HEAD"], {
        encoding: "utf8",
      })
        .trim()
        .split(" "),
    });
    check(env.IDENTITY_PATH, "Missing identity output path");
    mkdirSync(dirname(env.IDENTITY_PATH), { recursive: true });
    writeFileSync(env.IDENTITY_PATH, `${JSON.stringify(record)}\n`);
    return;
  }
  check(
    env.ROUTE_RESULT === "success" &&
      env.VALIDATION_MODE === validationRoute(env.GITHUB_EVENT_NAME, payload),
    "Validation routing failed or changed",
  );
  const results = {
    validation: env.VALIDATION_RESULT,
    dependencyReview: env.DEPENDENCY_REVIEW_RESULT,
  };
  if (env.GITHUB_EVENT_NAME !== "pull_request") {
    check(
      accept({
        event: env.GITHUB_EVENT_NAME,
        ...results,
        commitlint: "skipped",
      }),
      "Required repository validation did not succeed",
    );
    return;
  }
  const report = await evaluatePr({
    api: githubClient(env.GITHUB_REPOSITORY, env.GITHUB_TOKEN),
    identity: candidateIdentity(payload, env.GITHUB_SHA),
    mode: validationRoute(env.GITHUB_EVENT_NAME, payload),
    results,
    lint: lintTitle,
    runId: Number(env.GITHUB_RUN_ID),
    accept,
  });
  console.log("Current PR title and candidate validation verified.");
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `## Quality checks\n\nCandidate: ${report.identity.candidate}\n\nRoute: ${report.mode}\n\nEvidence: ${report.evidence?.url ?? "this run"}\n\nCurrent PR title passed commitlint and remained unchanged at final verification.\n`,
    );
  }
}
