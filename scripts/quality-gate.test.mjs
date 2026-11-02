import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { crc32 } from "node:zlib";

import { qualityGate } from "./quality-gate.mjs";
import {
  candidateIdentity,
  createIdentity,
  EVIDENCE_DAYS,
  evaluatePr,
  githubClient,
  resolveEvidence,
  runQualityCli,
  validationRoute,
  verifyIdentity,
} from "./pr-validation-evidence.mjs";

const sha = (letter) => letter.repeat(40);
const repo = "Oxelio/architecture-web";
const now = Date.now();
const timestamp = new Date(now - 60000).toISOString();
const payload = {
  action: "opened",
  repository: { id: 1, full_name: repo },
  pull_request: {
    number: 90,
    state: "open",
    title: "ci: validate PR metadata",
    merge_commit_sha: sha("c"),
    head: { sha: sha("a"), repo: { id: 1, full_name: repo } },
    base: { ref: "main", sha: sha("b") },
  },
};
const identity = candidateIdentity(payload, sha("c"));

// A stored ZIP fixture avoids a platform-specific archive creation dependency.
function identityZip(content) {
  const name = Buffer.from("identity.json"),
    data = Buffer.from(content);
  const local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc32(data), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc32(data), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}
const env = {
  CANDIDATE_SHA: sha("c"),
  COMPARISON_BASE: sha("b"),
  GITHUB_SHA: sha("c"),
  GITHUB_WORKFLOW_SHA: sha("c"),
  GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/delivery-automation-validation.yml@refs/pull/90/merge`,
  GITHUB_RUN_ID: "10",
  GITHUB_RUN_ATTEMPT: "2",
  VALIDATION_JOB: "primary",
};
function record(job = "primary") {
  return createIdentity({
    env: { ...env, VALIDATION_JOB: job },
    payload,
    checkout: sha("c"),
    parents: [sha("b"), sha("a")],
    now: now - 60000,
  });
}
function fixture() {
  const source = {
    id: 10,
    run_number: 10,
    run_attempt: 2,
    workflow_id: 5,
    check_suite_id: 7,
    event: "pull_request",
    path: ".github/workflows/delivery-automation-validation.yml",
    display_title: "Repository CI [full] PR #90",
    repository: payload.repository,
    head_repository: payload.pull_request.head.repo,
    head_sha: sha("a"),
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/Oxelio/architecture-web/actions/runs/10",
    referenced_workflows: [
      {
        path: `${repo}/.github/workflows/repository-validation.yml@${sha("c")}`,
        sha: sha("c"),
        ref: "refs/pull/90/merge",
      },
    ],
  };
  const names = [
    "validate / Validate repository and delivery tooling",
    "validate / Node 24 compatibility",
    "Dependency review",
    "Quality checks",
  ];
  const jobs = names.map((name, index) => ({
    id: 100 + index,
    name,
    run_id: 10,
    head_sha: sha("a"),
    status: "completed",
    conclusion: "success",
    check_run_url: `https://api.github.com/repos/${repo}/check-runs/${100 + index}`,
    steps: [
      { name: "Record PR validation identity", conclusion: "success" },
      { name: "Publish PR validation identity", conclusion: "success" },
      { name: "Install locked dependencies", conclusion: "success" },
    ],
  }));
  const artifacts = ["primary", "node24"].map((job, index) => ({
    id: index + 20,
    name: `pr-validation-identity-2-${job}`,
    size_in_bytes: 500,
    expired: false,
    created_at: timestamp,
    expires_at: new Date(now + 86400000).toISOString(),
    digest: "sha256:" + "a".repeat(64),
    workflow_run: {
      id: 10,
      repository_id: 1,
      head_repository_id: 1,
      head_sha: sha("a"),
    },
  }));
  const records = [record(), record("node24")];
  const runs = [source];
  const checks = jobs.map((job) => ({
    name: job.name,
    app: { id: 15368 },
    check_suite: { id: 7 },
    head_sha: sha("a"),
    status: "completed",
    conclusion: "success",
  }));
  const state = {
    source,
    jobs,
    artifacts,
    records,
    runs,
    checks,
    live: structuredClone(payload.pull_request),
    reads: [],
  };
  state.api = {
    async request(path) {
      state.reads.push(path);
      if (path === "/actions/runs/99") return { workflow_id: 5 };
      if (path === "/actions/runs/10") return state.source;
      if (path.startsWith("/check-runs/"))
        return state.checks[Number(path.split("/").at(-1)) - 100];
      if (path === "/pulls/90") return structuredClone(state.live);
      throw new Error(`Unexpected request: ${path}`);
    },
    async pages(path, key) {
      state.reads.push(path);
      if (key === "workflow_runs") return state.runs;
      if (path === "/actions/runs/10/attempts/2/jobs") return state.jobs;
      if (path === "/actions/runs/10/artifacts") return state.artifacts;
      throw new Error(`Unexpected pages: ${path}`);
    },
    async artifact(id) {
      return state.records[id - 20];
    },
  };
  state.resolve = () =>
    resolveEvidence({ api: state.api, identity, runId: 99, now });
  return state;
}

test("only explicit title/body edits use metadata validation", () => {
  for (const changes of [
    { body: { from: "old" } },
    { title: { from: "old" } },
    { title: {}, body: {} },
  ]) {
    assert.equal(
      validationRoute("pull_request", {
        ...payload,
        action: "edited",
        changes,
      }),
      "metadata",
    );
  }
  for (const action of [
    "opened",
    "reopened",
    "synchronize",
    "ready_for_review",
  ])
    assert.equal(
      validationRoute("pull_request", { ...payload, action }),
      "full",
    );
  for (const changes of [
    undefined,
    {},
    { base: {} },
    { title: {}, base: {} },
    { unknown: {} },
    { title: {}, unknown: {} },
  ]) {
    assert.equal(
      validationRoute("pull_request", {
        ...payload,
        action: "edited",
        changes,
      }),
      "full",
    );
  }
  for (const event of ["push", "workflow_dispatch"])
    assert.equal(validationRoute(event, payload), "full");
});

test("identity records actual inputs, checkout and merge parents rather than inferred run inputs", () => {
  assert.equal(record().comparisonBaseInput, sha("b"));
  assert.equal(record("node24").job, "node24");
  for (const replacement of [
    { checkout: sha("d") },
    { parents: [sha("a"), sha("b")] },
    { env: { ...env, COMPARISON_BASE: sha("d") } },
    { env: { ...env, GITHUB_WORKFLOW_SHA: sha("a") } },
    { env: { ...env, GITHUB_RUN_ATTEMPT: "0" } },
  ]) {
    assert.throws(() =>
      createIdentity({
        env,
        payload,
        checkout: sha("c"),
        parents: [sha("b"), sha("a")],
        ...replacement,
      }),
    );
  }
  assert.throws(() => candidateIdentity({}, sha("c")), /Incomplete/u);
});

test("metadata skips alone never count as validation evidence", () => {
  const good = {
    event: "pull_request",
    mode: "metadata",
    validation: "skipped",
    dependencyReview: "skipped",
    commitlint: "success",
    evidence: { verified: true },
  };
  assert.equal(qualityGate(good), true);
  for (const replacement of [
    { evidence: undefined },
    { evidence: { verified: false } },
    { commitlint: "failure" },
    { validation: "success" },
    { dependencyReview: "cancelled" },
    { event: "push" },
    { mode: "unknown" },
  ])
    assert.equal(qualityGate({ ...good, ...replacement }), false);
});

test("successful original run, provider, jobs, attempt and immutable identities are all required", async () => {
  const f = fixture();
  assert.deepEqual(await f.resolve(), {
    verified: true,
    runId: 10,
    attempt: 2,
    url: f.source.html_url,
  });
  assert.ok(f.reads.includes("/actions/runs/10/attempts/2/jobs"));
});

test("run markers, successful head checks and older green runs cannot substitute for proof", async () => {
  for (const result of ["failure", "cancelled", "skipped", "neutral", null]) {
    const f = fixture();
    f.source.conclusion = result;
    f.runs.push({
      ...structuredClone(f.source),
      id: 9,
      run_number: 9,
      conclusion: "success",
    });
    await assert.rejects(f.resolve(), /Newest full/u);
  }
  for (const status of ["queued", "in_progress", "waiting"]) {
    const f = fixture();
    f.source.status = status;
    await assert.rejects(f.resolve(), /Newest full/u);
  }
  for (const mutate of [
    (f) => {
      f.runs.length = 0;
    },
    (f) => {
      f.source.display_title = "Repository CI [metadata] PR #90";
    },
    (f) => {
      f.source.repository = { id: 2, full_name: "other/repo" };
    },
    (f) => {
      f.source.head_repository = { id: 2 };
    },
    (f) => {
      f.source.path = ".github/workflows/other.yml";
    },
    (f) => {
      f.source.event = "workflow_dispatch";
    },
    (f) => {
      f.source.referenced_workflows[0].sha = sha("d");
    },
    (f) => {
      f.source.referenced_workflows[0].ref = "refs/pull/91/merge";
    },
    (f) => {
      f.jobs.pop();
    },
    (f) => {
      f.jobs.push(f.jobs[0]);
    },
    (f) => {
      f.checks[0].app.id = 12526;
    },
    (f) => {
      f.checks[0].check_suite.id = 8;
    },
    (f) => {
      f.jobs[0].check_run_url = "https://attacker.invalid/100";
    },
    (f) => {
      f.jobs[0].steps.reverse();
    },
    (f) => {
      f.artifacts.pop();
    },
    (f) => {
      f.artifacts.push(f.artifacts[0]);
    },
    (f) => {
      f.records[0].attempt = 1;
    },
    (f) => {
      f.records[0].identity.base = sha("d");
    },
    (f) => {
      f.records[0].workflowSha = sha("d");
    },
    (f) => {
      f.records[0].runId = 9;
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(f.resolve());
  }
  for (const name of [
    "failure",
    "cancelled",
    "skipped",
    "neutral",
    undefined,
  ]) {
    const f = fixture();
    f.jobs[0].conclusion = name;
    await assert.rejects(f.resolve(), /Source job/u);
  }
});

test("retention is bounded by original evidence age and actual platform expiration", () => {
  for (const change of [
    (r, a) => {
      a.expired = true;
    },
    (r, a) => {
      a.expires_at = timestamp;
    },
    (r) => {
      r.createdAt = new Date(
        now - (EVIDENCE_DAYS + 1) * 86400000,
      ).toISOString();
    },
    (r) => {
      r.createdAt = new Date(now + 1000).toISOString();
    },
    (r, a) => {
      a.workflow_run.id = 9;
    },
    (r, a) => {
      a.workflow_run.head_sha = sha("d");
    },
  ]) {
    const f = fixture(),
      r = record(),
      a = f.artifacts[0];
    change(r, a);
    assert.throws(() =>
      verifyIdentity(r, {
        identity,
        source: f.source,
        job: "primary",
        artifact: a,
        now,
      }),
    );
  }
});

test("a source rerun beginning during evidence resolution invalidates the result", async () => {
  const f = fixture(),
    request = f.api.request;
  f.api.request = async (path) =>
    path === "/actions/runs/10"
      ? { ...f.source, run_attempt: 3 }
      : request(path);
  await assert.rejects(f.resolve(), /attempt changed/u);
});

test("a newer full run starting during resolution cannot be ignored", async () => {
  const f = fixture();
  const pages = f.api.pages;
  let lists = 0;
  f.api.pages = async (path, key) => {
    if (key === "workflow_runs" && ++lists === 2) {
      return [
        ...f.runs,
        {
          ...f.source,
          id: 11,
          run_number: 11,
          status: "in_progress",
          conclusion: null,
        },
      ];
    }
    return pages(path, key);
  };
  await assert.rejects(f.resolve(), /Newer full/u);
});

test("valid metadata edits reuse the original complete evidence", async () => {
  const f = fixture();
  const result = await evaluatePr({
    api: f.api,
    identity,
    mode: "metadata",
    results: { validation: "skipped", dependencyReview: "skipped" },
    lint: () => true,
    runId: 99,
    accept: qualityGate,
  });
  assert.equal(result.evidence.runId, 10);
});

test("full validation finishing after a lightweight failure validates the live invalid title", async () => {
  const f = fixture();
  f.live.title = "invalid title";
  for (const mode of ["metadata", "full"]) {
    await assert.rejects(
      evaluatePr({
        api: f.api,
        identity,
        mode,
        results: { validation: "success", dependencyReview: "success" },
        lint: (title) => title.startsWith("ci:"),
        runId: 99,
        accept: qualityGate,
      }),
      /Current PR title/u,
    );
  }
});

test("title correction passes with complete evidence; shell text is passed as title data", async () => {
  const f = fixture();
  f.live.title = "ci: handle $(literal) `text` safely";
  let seen;
  const result = await evaluatePr({
    api: f.api,
    identity,
    mode: "full",
    results: { validation: "success", dependencyReview: "success" },
    lint: (title) => {
      seen = title;
      return true;
    },
    runId: 99,
    accept: qualityGate,
  });
  assert.equal(seen, f.live.title);
  assert.equal(result.title, seen);
});

test("a title or candidate change during final verification fails closed", async () => {
  for (const change of [
    (pr) => {
      pr.title = "invalid";
    },
    (pr) => {
      pr.head.sha = sha("d");
    },
    (pr) => {
      pr.base.sha = sha("d");
    },
    (pr) => {
      pr.merge_commit_sha = null;
    },
    (pr) => {
      pr.state = "closed";
    },
  ]) {
    const f = fixture();
    await assert.rejects(
      evaluatePr({
        api: f.api,
        identity,
        mode: "full",
        results: { validation: "success", dependencyReview: "success" },
        lint: () => {
          change(f.live);
          return true;
        },
        runId: 99,
        accept: qualityGate,
      }),
    );
  }
});

test("API pagination is complete and API failures are never clean evidence", async () => {
  let requests = 0;
  const client = githubClient(repo, "fixture", async () => ({
    ok: true,
    json: async () => ({
      total_count: 101,
      jobs: ++requests === 1 ? Array(100).fill({}) : [{}],
    }),
  }));
  assert.equal(
    (await client.pages("/actions/runs/10/jobs", "jobs")).length,
    101,
  );
  assert.equal(requests, 2);
  await assert.rejects(
    githubClient(repo, "fixture", async () => ({
      ok: false,
      status: 403,
    })).request("/pulls/90"),
    /403/u,
  );
  await assert.rejects(
    githubClient(repo, "fixture", async () => ({
      ok: true,
      json: async () => ({ total_count: 2, jobs: [{}] }),
    })).pages("/jobs", "jobs"),
    /Truncated/u,
  );
  await assert.rejects(
    githubClient(repo, "fixture", async () => ({
      ok: true,
      json: async () => ({ jobs: Array(100).fill({}) }),
    })).pages("/jobs", "jobs"),
    /limit/u,
  );
  assert.throws(() => githubClient(repo, ""), /unavailable/u);
});

test("artifact downloads check digest and do not forward credentials to storage", async () => {
  const calls = [];
  const client = githubClient(
    repo,
    "fixture-credential",
    async (url, options) => {
      calls.push({ url: String(url), options });
      return calls.length === 1
        ? {
            status: 302,
            headers: new Headers({
              location: "https://fixture.blob.core.windows.net/signed",
            }),
          }
        : { ok: true, arrayBuffer: async () => Buffer.from("not a zip") };
    },
  );
  await assert.rejects(
    client.artifact(20, `sha256:${"0".repeat(64)}`),
    /digest mismatch/u,
  );
  assert.equal(calls[1].options.headers, undefined);
  const invalid = githubClient(repo, "fixture", async () => ({
    status: 302,
    headers: new Headers({ location: "https://attacker.invalid" }),
  }));
  await assert.rejects(
    invalid.artifact(
      20,
      `sha256:${createHash("sha256").update("x").digest("hex")}`,
    ),
    /location/u,
  );
});

test("a real ZIP identity artifact is verified and parsed without executing contents", async () => {
  const bytes = identityZip(JSON.stringify(record()));
  let requests = 0;
  const client = githubClient(repo, "fixture", async () =>
    ++requests === 1
      ? {
          status: 302,
          headers: new Headers({
            location: "https://fixture.blob.core.windows.net/signed",
          }),
        }
      : { ok: true, arrayBuffer: async () => bytes },
  );
  const decoded = await client.artifact(
    20,
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
  assert.deepEqual(decoded, record());
});

test("CLI routing is explicit and a failed route cannot publish a green aggregate", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "quality-route-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const event = join(directory, "event.json"),
    output = join(directory, "output");
  writeFileSync(
    event,
    JSON.stringify({ ...payload, action: "edited", changes: { body: {} } }),
  );
  await runQualityCli(
    qualityGate,
    {
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: event,
      GITHUB_OUTPUT: output,
    },
    "route",
  );
  assert.equal(readFileSync(output, "utf8"), "mode=metadata\n");
  await assert.rejects(
    runQualityCli(
      qualityGate,
      {
        GITHUB_EVENT_NAME: "push",
        ROUTE_RESULT: "failure",
        VALIDATION_MODE: "full",
      },
      "gate",
    ),
    /routing/u,
  );
  await runQualityCli(
    qualityGate,
    {
      GITHUB_EVENT_NAME: "push",
      ROUTE_RESULT: "success",
      VALIDATION_MODE: "full",
      VALIDATION_RESULT: "success",
      DEPENDENCY_REVIEW_RESULT: "skipped",
    },
    "gate",
  );
});
