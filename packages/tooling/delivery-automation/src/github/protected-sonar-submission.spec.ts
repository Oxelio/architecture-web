import { createHash } from "node:crypto";

import { strToU8, zipSync } from "fflate";
import { expect, it, vi } from "vitest";

import { readGitHubProtectedSonarSubmission } from "./protected-sonar-submission.js";
import { sonarGateConditionsDigest } from "./sonar-analysis-evidence.js";

function fixture() {
  const submission = {
    repositoryId: 1336937640,
    projectKey: "Oxelio_architecture-web",
    workNumber: 140,
    pullNumber: 147,
    headSha: "a".repeat(40),
    baseSha: "b".repeat(40),
    sourceBranch: "codex/work-140",
    taskId: "trusted-ce-task",
    producerRunId: 456,
    producerRunAttempt: 1,
    controlSha: "c".repeat(40),
    scannerConfigDigest: "d".repeat(64),
    conditionsDigest: sonarGateConditionsDigest,
    startedAt: "2026-11-18T08:02:00Z",
    expiresAt: "2026-11-18T08:30:00Z",
  };
  const task = {
    id: submission.taskId,
    componentKey: submission.projectKey,
    type: "REPORT",
    status: "SUCCESS",
    analysisId: "fixture-analysis",
    submittedAt: "2026-11-18T08:02:10Z",
    executedAt: "2026-11-18T08:03:00Z",
  };
  let archive = zipSync({
    "submission.json": strToU8(JSON.stringify({ submission, task })),
  });
  const binding = {
    producerRunId: 456,
    producerWorkflowId: 789,
    controlSha: submission.controlSha,
    scannerConfigDigest: submission.scannerConfigDigest,
    artifactId: 123,
    archiveDigest: createHash("sha256").update(archive).digest("hex"),
  };
  const run = {
    id: 456,
    workflow_id: 789,
    run_attempt: 1,
    path: ".github/workflows/delivery-protected-sonar.yml",
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_sha: binding.controlSha,
    run_started_at: "2026-11-18T08:00:00Z",
    repository: { id: 1336937640 },
    head_repository: { id: 1336937640 },
  };
  const job = {
    id: 111,
    run_id: 456,
    name: "Protected Sonar producer",
    status: "completed",
    conclusion: "success",
    started_at: "2026-11-18T08:01:00Z",
    completed_at: "2026-11-18T08:05:00Z",
  };
  const artifact = {
    id: 123,
    name: "protected-sonar-submission",
    expired: false,
    digest: `sha256:${binding.archiveDigest}`,
    size_in_bytes: archive.byteLength,
    created_at: "2026-11-18T08:04:00Z",
    workflow_run: {
      id: 456,
      repository_id: 1336937640,
      head_repository_id: 1336937640,
      head_branch: "main",
      head_sha: binding.controlSha,
    },
  };
  let location =
    "https://productionresultssafixture.blob.core.windows.net/artifact.zip?synthetic";
  const fetchImpl = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const value = new URL(String(url));
      if (value.hostname.endsWith("blob.core.windows.net")) {
        expect(init?.headers).toBeUndefined();
        return new Response(Buffer.from(archive));
      }
      expect((init?.headers as Record<string, string>)["Authorization"]).toBe(
        "Bearer synthetic-github-reader",
      );
      if (value.pathname.endsWith("/zip")) {
        return new Response(null, { status: 302, headers: { location } });
      }
      if (value.pathname.endsWith("/actions/runs/456")) {
        return Response.json(run);
      }
      if (value.pathname.endsWith("/attempts/1/jobs")) {
        return Response.json({ total_count: 1, jobs: [job] });
      }
      if (value.pathname.endsWith("/actions/artifacts/123")) {
        return Response.json(artifact);
      }
      throw new Error("Unexpected fixture request");
    },
  );
  const input = {
    enabled: true,
    githubReadToken: "synthetic-github-reader",
    binding,
    candidate: {
      repositoryId: submission.repositoryId,
      workNumber: 140,
      pullNumber: 147,
      headSha: submission.headSha,
      baseSha: submission.baseSha,
      sourceBranch: submission.sourceBranch,
    },
    fetchImpl,
    now: () => Date.parse("2026-11-18T08:10:00Z"),
  };
  const replace = (bytes: Uint8Array) => {
    archive = new Uint8Array(bytes);
    binding.archiveDigest = createHash("sha256").update(archive).digest("hex");
    artifact.digest = `sha256:${binding.archiveDigest}`;
  };
  return {
    input,
    submission,
    task,
    run,
    job,
    artifact,
    fetchImpl,
    replace,
    redirect: (value: string) => {
      location = value;
    },
  };
}

it("authenticates the exact protected run, artifact archive and receipt without leaking GitHub credentials", async () => {
  const f = fixture();
  expect(await readGitHubProtectedSonarSubmission(f.input)).toMatchObject({
    submission: f.submission,
    provenanceDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
  });
  expect(f.fetchImpl).toHaveBeenCalledTimes(7);
});

it("is inactive without making provider calls", async () => {
  const f = fixture();
  expect(
    await readGitHubProtectedSonarSubmission({ ...f.input, enabled: false }),
  ).toBeNull();
  expect(f.fetchImpl).not.toHaveBeenCalled();
});

it.each([
  "candidate-workflow",
  "rerun",
  "wrong-control",
  "failed-producer",
  "wrong-artifact-run",
  "expired-artifact",
  "wrong-archive",
  "extra-file",
  "wrong-candidate",
  "wrong-task",
  "changed-criteria",
  "unsafe-redirect",
  "oversized-body",
])(
  "rejects %s instead of accepting namesake or stale evidence",
  async (failure) => {
    const f = fixture();
    switch (failure) {
      case "candidate-workflow":
        f.run.path = ".github/workflows/candidate.yml";
        break;
      case "rerun":
        f.run.run_attempt = 2;
        break;
      case "wrong-control":
        f.run.head_sha = "e".repeat(40);
        break;
      case "failed-producer":
        f.job.conclusion = "failure";
        break;
      case "wrong-artifact-run":
        f.artifact.workflow_run.id = 457;
        break;
      case "expired-artifact":
        f.artifact.expired = true;
        break;
      case "wrong-archive":
        f.artifact.digest = `sha256:${"e".repeat(64)}`;
        break;
      case "extra-file":
        f.replace(
          zipSync({
            "submission.json": strToU8(
              JSON.stringify({ submission: f.submission, task: f.task }),
            ),
            "extra.txt": strToU8("fixture"),
          }),
        );
        break;
      case "wrong-candidate":
        f.replace(
          zipSync({
            "submission.json": strToU8(
              JSON.stringify({
                submission: { ...f.submission, headSha: "e".repeat(40) },
                task: f.task,
              }),
            ),
          }),
        );
        break;
      case "changed-criteria":
        f.replace(
          zipSync({
            "submission.json": strToU8(
              JSON.stringify({
                submission: {
                  ...f.submission,
                  conditionsDigest: "e".repeat(64),
                },
                task: f.task,
              }),
            ),
          }),
        );
        break;
      case "wrong-task":
        f.replace(
          zipSync({
            "submission.json": strToU8(
              JSON.stringify({
                submission: f.submission,
                task: { ...f.task, id: "unrelated-task" },
              }),
            ),
          }),
        );
        break;
      case "unsafe-redirect":
        f.redirect("https://untrusted.invalid/artifact.zip");
        break;
      case "oversized-body":
        f.replace(new Uint8Array(65537));
        break;
      default:
        throw new Error("Unexpected fixture case");
    }
    expect(await readGitHubProtectedSonarSubmission(f.input)).toBeNull();
  },
);
