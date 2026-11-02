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
function check(condition, message) {
  if (!condition) throw new Error(message);
}

export function validationRoute(event, payload) {
  const changes = Object.keys(payload.changes ?? {});
  return event === "pull_request" &&
    payload.action === "edited" &&
    changes.length > 0 &&
    changes.every((key) => ["title", "body"].includes(key))
    ? "metadata"
    : "full";
}

export function candidateIdentity(payload, candidate) {
  const pr = payload.pull_request;
  const identity = {
    repositoryId: payload.repository?.id,
    repository: payload.repository?.full_name,
    pr: pr?.number,
    headRepositoryId: pr?.head?.repo?.id,
    headRepository: pr?.head?.repo?.full_name,
    head: pr?.head?.sha,
    baseRef: pr?.base?.ref,
    base: pr?.base?.sha,
    candidate,
  };
  check(
    [identity.head, identity.base, candidate].every((sha) =>
      /^[a-f0-9]{40}$/u.test(sha ?? ""),
    ) &&
      [identity.repositoryId, identity.headRepositoryId, identity.pr].every(
        (id) => Number.isSafeInteger(id) && id > 0,
      ) &&
      typeof identity.repository === "string" &&
      typeof identity.headRepository === "string" &&
      identity.baseRef === "main",
    "Incomplete PR candidate identity",
  );
  return identity;
}

export function createIdentity({
  env,
  payload,
  checkout,
  parents,
  now = Date.now(),
}) {
  const identity = candidateIdentity(payload, env.CANDIDATE_SHA);
  check(
    checkout === identity.candidate &&
      env.GITHUB_SHA === identity.candidate &&
      env.COMPARISON_BASE === identity.base &&
      env.GITHUB_WORKFLOW_SHA === identity.candidate &&
      env.GITHUB_WORKFLOW_REF ===
        `${identity.repository}/${caller}@refs/pull/${identity.pr}/merge` &&
      Object.hasOwn(validationJobs, env.VALIDATION_JOB),
    "Actual inputs/checkout do not match the PR candidate",
  );
  if (env.VALIDATION_JOB === "primary")
    check(
      JSON.stringify(parents) ===
        JSON.stringify([identity.base, identity.head]),
      "Merge candidate parents do not match base and head",
    );
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

export function githubClient(repository, token, fetchImpl = fetch) {
  check(
    /^[\w.-]+\/[\w.-]+$/u.test(repository) && Boolean(token),
    "Read-only GitHub access is unavailable",
  );
  const root = `https://api.github.com/repos/${repository}`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2026-03-10",
  };
  async function request(path) {
    check(path.startsWith("/") && !path.includes(".."), "Invalid API path");
    const response = await fetchImpl(`${root}${path}`, {
      headers,
      signal: AbortSignal.timeout(30000),
      redirect: "manual",
    });
    check(response.ok, `GitHub evidence read failed: HTTP ${response.status}`);
    return response.json();
  }
  async function pages(path, key) {
    const items = [];
    for (let page = 1; page <= 10; page += 1) {
      const response = await request(
        `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      );
      check(Array.isArray(response[key]), "Incomplete paginated evidence");
      items.push(...response[key]);
      if (response[key].length < 100) {
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
  async function artifact(id, digest) {
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

function fresh(timestamp, now) {
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= lifetime;
}
export function verifyIdentity(
  record,
  { identity, source, job, artifact, now },
) {
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
      Date.parse(artifact.expires_at) > now &&
      artifact.workflow_run?.id === source.id &&
      artifact.workflow_run?.repository_id === identity.repositoryId &&
      artifact.workflow_run?.head_repository_id === identity.headRepositoryId &&
      artifact.workflow_run?.head_sha === identity.head,
    "Identity artifact does not prove this candidate/run/attempt or has expired",
  );
}

export async function resolveEvidence({
  api,
  identity,
  runId,
  now = Date.now(),
}) {
  const current = await api.request(`/actions/runs/${runId}`);
  const runs = await api.pages(
    `/actions/runs?event=pull_request&head_sha=${identity.head}`,
    "workflow_runs",
  );
  const sources = runs.filter(
    (run) =>
      run.id !== runId &&
      run.workflow_id === current.workflow_id &&
      run.display_title === `Repository CI [full] PR #${identity.pr}`,
  );
  sources.sort((a, b) => b.run_number - a.run_number);
  const source = sources[0];
  check(
    source,
    "No original full PR validation evidence; run full PR validation",
  );
  check(
    source.event === "pull_request" &&
      source.path === caller &&
      source.repository?.id === identity.repositoryId &&
      source.repository?.full_name === identity.repository &&
      source.head_repository?.id === identity.headRepositoryId &&
      source.head_sha === identity.head &&
      source.status === "completed" &&
      source.conclusion === "success" &&
      Number.isSafeInteger(source.run_attempt) &&
      source.run_attempt > 0 &&
      source.referenced_workflows?.some(
        (workflow) =>
          workflow.path ===
            `${identity.repository}/${reusable}@${identity.candidate}` &&
          workflow.sha === identity.candidate &&
          workflow.ref === `refs/pull/${identity.pr}/merge`,
      ),
    "Newest full validation is unsuccessful, pending, or bound to another candidate",
  );
  const jobs = await api.pages(
    `/actions/runs/${source.id}/attempts/${source.run_attempt}/jobs`,
    "jobs",
  );
  const artifacts = await api.pages(
    `/actions/runs/${source.id}/artifacts`,
    "artifacts",
  );
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
        job.run_id === source.id &&
          job.head_sha === identity.head &&
          job.status === "completed" &&
          job.conclusion === "success" &&
          job.check_run_url?.startsWith(prefix) &&
          /^\d+$/u.test(job.check_run_url.slice(prefix.length)),
        `Source job did not succeed: ${name}`,
      );
      const result = await api.request(
        `/check-runs/${job.check_run_url.slice(prefix.length)}`,
      );
      check(
        result.name === name &&
          result.app?.id === 15368 &&
          result.check_suite?.id === source.check_suite_id &&
          result.head_sha === identity.head &&
          result.status === "completed" &&
          result.conclusion === "success",
        `Source check provenance mismatch: ${name}`,
      );
    }),
  );
  await Promise.all(
    Object.entries(validationJobs).map(async ([job, name]) => {
      const steps = jobs.find((item) => item.name === name).steps ?? [];
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
          item.name === `pr-validation-identity-${source.run_attempt}-${job}`,
      );
      check(
        matches.length === 1,
        "Missing or ambiguous source identity artifact",
      );
      const artifact = matches[0];
      check(
        Number.isSafeInteger(artifact.id) &&
          artifact.id > 0 &&
          artifact.size_in_bytes <= 65536 &&
          artifact.expired === false,
        "Unavailable identity artifact",
      );
      verifyIdentity(await api.artifact(artifact.id, artifact.digest), {
        identity,
        source,
        job,
        artifact,
        now,
      });
    }),
  );
  const latest = await api.request(`/actions/runs/${source.id}`);
  check(
    latest.run_attempt === source.run_attempt &&
      latest.status === "completed" &&
      latest.conclusion === "success",
    "Source attempt changed during evidence verification",
  );
  const refreshed = await api.pages(
    `/actions/runs?event=pull_request&head_sha=${identity.head}`,
    "workflow_runs",
  );
  check(
    !refreshed.some(
      (run) =>
        run.id !== runId &&
        run.workflow_id === current.workflow_id &&
        run.display_title === `Repository CI [full] PR #${identity.pr}` &&
        run.run_number > source.run_number,
    ),
    "Newer full validation started during evidence verification",
  );
  return {
    verified: true,
    runId: source.id,
    attempt: source.run_attempt,
    url: source.html_url,
  };
}

export function assertLiveCandidate(pr, identity, candidate) {
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

async function readLivePr(api, identity) {
  const pr = await api.request(`/pulls/${identity.pr}`);
  // REST 2026-03-10 removes merge_commit_sha from PR responses. Read the
  // actual synthetic merge ref instead of inferring a candidate from the head.
  const merge = await api.request(`/git/ref/pull/${identity.pr}/merge`);
  check(
    merge.ref === `refs/pull/${identity.pr}/merge` &&
      merge.object?.type === "commit",
    "Live PR merge reference is unavailable or invalid",
  );
  assertLiveCandidate(pr, identity, merge.object.sha);
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
}) {
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

export function lintTitle(title) {
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
  accept,
  env = process.env,
  command = process.argv[2],
) {
  const payload = env.GITHUB_EVENT_PATH
    ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"))
    : {};
  if (command === "route") {
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
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `## Quality checks\n\nCandidate: ${report.identity.candidate}\n\nRoute: ${report.mode}\n\nEvidence: ${report.evidence?.url ?? "this run"}\n\nCurrent PR title passed commitlint and remained unchanged at final verification.\n`,
    );
}
