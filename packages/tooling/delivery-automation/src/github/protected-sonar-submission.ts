import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { unzipSync } from "fflate";
import { z } from "zod";

import type { FetchLike } from "./github-project-inventory.js";
import {
  type ProtectedSonarSubmission,
  type SonarCandidate,
  sonarGateConditionsDigest,
} from "./sonar-analysis-evidence.js";

const repositoryId = 1336937640;
const repository = "https://api.github.com/repos/Oxelio/architecture-web";
const producerPath = ".github/workflows/delivery-protected-sonar.yml";
const producerJob = "Protected Sonar producer";
const artifactName = "protected-sonar-submission";
const receiptName = "submission.json";
const maximumArchiveBytes = 65536;
const maximumReceiptBytes = 8192;
const sha = z.string().regex(/^[a-f0-9]{40}$/u);
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const id = z.number().int().positive().safe();
const instant = z.string().datetime();
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const runSchema = z.object({
  id,
  workflow_id: id,
  run_attempt: z.literal(1),
  path: z.literal(producerPath),
  event: z.literal("workflow_dispatch"),
  status: z.literal("completed"),
  conclusion: z.literal("success"),
  head_branch: z.literal("main"),
  head_sha: sha,
  run_started_at: instant,
  repository: z.object({ id: z.literal(repositoryId) }),
  head_repository: z.object({ id: z.literal(repositoryId) }),
});
const jobSchema = z.object({
  id,
  run_id: id,
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: instant.nullable(),
  completed_at: instant.nullable(),
});
const artifactSchema = z.object({
  id,
  name: z.literal(artifactName),
  expired: z.literal(false),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  size_in_bytes: z.number().int().positive().max(maximumArchiveBytes),
  created_at: instant,
  workflow_run: z.object({
    id,
    repository_id: z.literal(repositoryId),
    head_repository_id: z.literal(repositoryId),
    head_branch: z.literal("main"),
    head_sha: sha,
  }),
});
const submissionSchema = z.strictObject({
  repositoryId: z.literal(repositoryId),
  projectKey: z.literal("Oxelio_architecture-web"),
  workNumber: id,
  pullNumber: id,
  headSha: sha,
  baseSha: sha,
  sourceBranch: z.string().min(1).max(255),
  taskId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/u),
  producerRunId: id,
  producerRunAttempt: z.literal(1),
  controlSha: sha,
  scannerConfigDigest: hash,
  conditionsDigest: z.literal(sonarGateConditionsDigest),
  startedAt: instant,
  expiresAt: instant,
});

export const protectedSonarTaskSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/u),
  componentKey: z.literal("Oxelio_architecture-web"),
  type: z.literal("REPORT"),
  status: z.enum(["SUCCESS", "FAILED", "CANCELED"]),
  analysisId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,200}$/u)
    .optional(),
  submittedAt: z.string(),
  executedAt: z.string(),
});
export type ProtectedSonarTask = z.infer<typeof protectedSonarTaskSchema>;
const receiptSchema = z.strictObject({
  submission: submissionSchema,
  task: protectedSonarTaskSchema.nullable(),
});

export interface ProtectedSonarArtifactBinding {
  readonly producerRunId: number;
  readonly producerWorkflowId: number;
  readonly controlSha: string;
  readonly scannerConfigDigest: string;
  readonly artifactId: number;
  readonly archiveDigest: string;
}

interface SourceInput {
  readonly enabled?: boolean;
  readonly githubReadToken: string;
  // This binding comes from the protected producer/controller record. A run ID
  // or artifact name received in a candidate's request establishes no trust.
  readonly binding: ProtectedSonarArtifactBinding;
  readonly candidate: SonarCandidate;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => number;
}

function validBinding(input: SourceInput) {
  const binding = z
    .strictObject({
      producerRunId: id,
      producerWorkflowId: id,
      controlSha: sha,
      scannerConfigDigest: hash,
      artifactId: id,
      archiveDigest: hash,
    })
    .safeParse(input.binding);
  return binding.success && input.githubReadToken.trim().length > 0;
}

function githubGet(
  input: SourceInput,
  path: string,
  redirect: "manual" | "error" = "error",
) {
  return (input.fetchImpl ?? fetch)(`${repository}${path}`, {
    headers: {
      Authorization: `Bearer ${input.githubReadToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    redirect,
    signal: AbortSignal.timeout(10000),
  });
}

async function readRun(input: SourceInput) {
  const response = await githubGet(
    input,
    `/actions/runs/${input.binding.producerRunId}`,
  );
  if (response.status !== 200) {
    return null;
  }
  const parsed = runSchema.safeParse(await response.json());
  return parsed.success &&
    parsed.data.id === input.binding.producerRunId &&
    parsed.data.workflow_id === input.binding.producerWorkflowId &&
    parsed.data.head_sha === input.binding.controlSha
    ? parsed.data
    : null;
}

async function readProducerJob(input: SourceInput) {
  const response = await githubGet(
    input,
    `/actions/runs/${input.binding.producerRunId}/attempts/1/jobs?per_page=100`,
  );
  if (
    response.status !== 200 ||
    response.headers.get("link")?.includes('rel="next"')
  ) {
    return null;
  }
  const parsed = z
    .object({
      total_count: z.number().int().min(1).max(100),
      jobs: z.array(jobSchema).max(100),
    })
    .safeParse(await response.json());
  if (!parsed.success || parsed.data.total_count !== parsed.data.jobs.length) {
    return null;
  }
  const jobs = parsed.data.jobs.filter((value) => value.name === producerJob);
  const job = jobs.length === 1 ? jobs[0] : null;
  return job &&
    job.run_id === input.binding.producerRunId &&
    job.status === "completed" &&
    job.conclusion === "success" &&
    job.started_at &&
    job.completed_at
    ? job
    : null;
}

async function readArtifact(input: SourceInput) {
  const response = await githubGet(
    input,
    `/actions/artifacts/${input.binding.artifactId}`,
  );
  if (response.status !== 200) {
    return null;
  }
  const parsed = artifactSchema.safeParse(await response.json());
  return parsed.success &&
    parsed.data.id === input.binding.artifactId &&
    parsed.data.workflow_run.id === input.binding.producerRunId &&
    parsed.data.workflow_run.head_sha === input.binding.controlSha &&
    parsed.data.digest === `sha256:${input.binding.archiveDigest}`
    ? parsed.data
    : null;
}

async function boundedArchive(response: Response) {
  if (response.status !== 200 || !response.body) {
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const value = await reader.read();
      if (value.done) {
        break;
      }
      length += value.value.byteLength;
      if (length > maximumArchiveBytes) {
        return null;
      }
      chunks.push(value.value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

async function downloadArchive(input: SourceInput) {
  const response = await githubGet(
    input,
    `/actions/artifacts/${input.binding.artifactId}/zip`,
    "manual",
  );
  if (response.status !== 302 || !response.headers.get("location")) {
    return null;
  }
  const url = new URL(response.headers.get("location") ?? "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/^productionresultssa[a-z0-9]+\.blob\.core\.windows\.net$/u.test(
      url.hostname,
    )
  ) {
    return null;
  }
  // The expiring provider redirect receives no GitHub bearer or other secret.
  const archive = await boundedArchive(
    await (input.fetchImpl ?? fetch)(url, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    }),
  );
  return archive &&
    createHash("sha256").update(archive).digest("hex") ===
      input.binding.archiveDigest
    ? archive
    : null;
}

function decodeSubmission(archive: Uint8Array) {
  let entries = 0;
  const files = unzipSync(archive, {
    filter: (entry) => {
      entries++;
      return (
        entry.name === receiptName && entry.originalSize <= maximumReceiptBytes
      );
    },
  });
  const bytes = files[receiptName];
  if (entries !== 1 || !bytes || bytes.byteLength > maximumReceiptBytes) {
    return null;
  }
  const parsed = receiptSchema.safeParse(
    JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown,
  );
  return parsed.success ? parsed.data : null;
}

function matchesSource(
  input: SourceInput,
  submission: ProtectedSonarSubmission,
) {
  const { candidate, binding } = input;
  return (
    submission.producerRunId === binding.producerRunId &&
    submission.controlSha === binding.controlSha &&
    submission.scannerConfigDigest === binding.scannerConfigDigest &&
    candidate.repositoryId === submission.repositoryId &&
    candidate.workNumber === submission.workNumber &&
    candidate.pullNumber === submission.pullNumber &&
    candidate.headSha === submission.headSha &&
    candidate.baseSha === submission.baseSha &&
    candidate.sourceBranch === submission.sourceBranch
  );
}

export async function readGitHubProtectedSonarSubmission(
  input: SourceInput,
): Promise<{
  readonly submission: ProtectedSonarSubmission;
  readonly task: ProtectedSonarTask | null;
  readonly provenanceDigest: string;
} | null> {
  if (input.enabled !== true) {
    return null;
  }
  try {
    if (!validBinding(input)) {
      return null;
    }
    const run = await readRun(input);
    const job = run ? await readProducerJob(input) : null;
    const artifact = job ? await readArtifact(input) : null;
    const archive = artifact ? await downloadArchive(input) : null;
    const receipt = archive ? decodeSubmission(archive) : null;
    const submission = receipt?.submission;
    if (
      !run ||
      !job ||
      !artifact ||
      !receipt ||
      !submission ||
      !matchesSource(input, submission)
    ) {
      return null;
    }
    const now = (input.now ?? Date.now)();
    const completedAt = Date.parse(job.completed_at ?? "");
    if (receipt.task) {
      const sent = Date.parse(receipt.task.submittedAt);
      const ended = Date.parse(receipt.task.executedAt);
      if (
        receipt.task.id !== submission.taskId ||
        !(
          Date.parse(submission.startedAt) <= sent &&
          sent <= ended &&
          ended <= completedAt
        )
      ) {
        return null;
      }
    }
    if (
      Date.parse(submission.startedAt) < Date.parse(run.run_started_at) ||
      Date.parse(submission.startedAt) > completedAt ||
      Date.parse(artifact.created_at) < Date.parse(run.run_started_at) ||
      Date.parse(artifact.created_at) > completedAt ||
      completedAt > now ||
      Date.parse(submission.expiresAt) <= now ||
      Date.parse(submission.expiresAt) <= Date.parse(submission.startedAt)
    ) {
      return null;
    }
    if (
      !isDeepStrictEqual(run, await readRun(input)) ||
      !isDeepStrictEqual(artifact, await readArtifact(input))
    ) {
      return null;
    }
    return {
      submission,
      task: receipt.task,
      provenanceDigest: digest([
        "protected-sonar-source",
        input.binding,
        job.id,
        digest(submission),
      ]),
    };
  } catch {
    // No provider diagnostics, redirect URLs, tokens or receipt bytes in logs.
    return null;
  }
}
