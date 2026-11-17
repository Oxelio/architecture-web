import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const projectKey = "Oxelio_architecture-web";
const shaPattern = /^[a-f0-9]{40}$/u;

// The protected producer snapshots these current provider criteria. A later
// policy change needs its owner's decision and a refreshed trusted receipt.
const conditions = [
  ["new_coverage", "LT", "80"],
  ["new_duplicated_lines_density", "GT", "3"],
  ["new_maintainability_rating", "GT", "1"],
  ["new_reliability_rating", "GT", "1"],
  ["new_security_hotspots_reviewed", "LT", "100"],
  ["new_security_rating", "GT", "1"],
] as const;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const sonarGateConditionsDigest = digest(conditions);

export interface ProtectedSonarSubmission {
  readonly repositoryId: number;
  readonly projectKey: string;
  readonly workNumber: number;
  readonly pullNumber: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly sourceBranch: string;
  readonly taskId: string;
  readonly producerRunId: number;
  readonly producerRunAttempt: number;
  readonly controlSha: string;
  readonly scannerConfigDigest: string;
  readonly conditionsDigest: string;
  readonly startedAt: string;
  readonly expiresAt: string;
}

export interface SonarCandidate {
  readonly repositoryId: number;
  readonly workNumber: number;
  readonly pullNumber: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly sourceBranch: string;
}

type SonarEvidenceResult =
  | { readonly status: "inactive" | "deferred" }
  | {
      readonly status: "verified";
      readonly submission: ProtectedSonarSubmission;
      readonly analysisId: string;
      readonly factsDigest: string;
    };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SONAR_RESPONSE_UNVERIFIED");
  }
  return value as Record<string, unknown>;
}

function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("SONAR_RESPONSE_UNVERIFIED");
  }
  return value;
}

function conditionTuples(value: unknown, result: boolean) {
  return list(value)
    .map((entry) => {
      const item = record(entry);
      const metric = item[result ? "metricKey" : "metric"];
      const comparator = item[result ? "comparator" : "op"];
      const threshold = item[result ? "errorThreshold" : "error"];
      if (
        typeof metric !== "string" ||
        typeof comparator !== "string" ||
        typeof threshold !== "string" ||
        (result && item["status"] !== "OK")
      ) {
        throw new Error("SONAR_CONDITIONS_UNVERIFIED");
      }
      return [metric, comparator, threshold];
    })
    .sort(([first = ""], [second = ""]) => first.localeCompare(second));
}

function matchesSubmission(
  candidate: SonarCandidate | null,
  submission: ProtectedSonarSubmission,
) {
  return (
    candidate?.repositoryId === 1336937640 &&
    candidate.workNumber === submission.workNumber &&
    candidate.pullNumber === submission.pullNumber &&
    candidate.headSha === submission.headSha &&
    candidate.baseSha === submission.baseSha &&
    candidate.sourceBranch === submission.sourceBranch
  );
}

// Preparation-only. No workflow calls this adapter and it cannot publish a
// check. Only trusted-main composition may supply readTrustedSubmission after
// authenticating the producer run, revision, source and exact scanner receipt.
export async function readSonarAnalysisEvidence(input: {
  readonly enabled?: boolean;
  readonly token: string;
  readonly readTrustedSubmission: () => Promise<ProtectedSonarSubmission | null>;
  readonly readCandidate: () => Promise<SonarCandidate | null>;
  readonly now?: () => number;
  readonly fetchImpl?: typeof fetch;
}): Promise<SonarEvidenceResult> {
  if (input.enabled !== true) {
    return { status: "inactive" };
  }
  const now = input.now ?? Date.now;
  try {
    const submission = await input.readTrustedSubmission();
    if (
      !submission ||
      !input.token.trim() ||
      submission.repositoryId !== 1336937640 ||
      submission.projectKey !== projectKey ||
      !Number.isSafeInteger(submission.workNumber) ||
      submission.workNumber <= 0 ||
      submission.producerRunAttempt !== 1 ||
      !Number.isSafeInteger(submission.pullNumber) ||
      submission.pullNumber <= 0 ||
      !Number.isSafeInteger(submission.producerRunId) ||
      submission.producerRunId <= 0 ||
      !shaPattern.test(submission.headSha) ||
      !shaPattern.test(submission.baseSha) ||
      !shaPattern.test(submission.controlSha) ||
      !/^[a-f0-9]{64}$/u.test(submission.scannerConfigDigest) ||
      submission.conditionsDigest !== sonarGateConditionsDigest ||
      !/^[A-Za-z0-9_-]{1,200}$/u.test(submission.taskId) ||
      !submission.sourceBranch ||
      !Number.isFinite(Date.parse(submission.startedAt)) ||
      Date.parse(submission.startedAt) > now() ||
      !(Date.parse(submission.expiresAt) > now()) ||
      !matchesSubmission(await input.readCandidate(), submission)
    ) {
      return { status: "deferred" };
    }

    const get = async (path: string) => {
      const response = await (input.fetchImpl ?? fetch)(
        `https://sonarcloud.io/api/${path}`,
        {
          headers: {
            accept: "application/json",
            authorization: `Bearer ${input.token}`,
          },
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (response.status !== 200 || response.redirected) {
        throw new Error("SONAR_READ_UNVERIFIED");
      }
      return record(await response.json());
    };

    if ((await get("authentication/validate"))["valid"] !== true) {
      return { status: "deferred" };
    }

    const taskPath = `ce/task?id=${encodeURIComponent(submission.taskId)}`;
    const prPath = `project_pull_requests/list?project=${projectKey}`;
    const task = record((await get(taskPath))["task"]);
    if (
      task["id"] !== submission.taskId ||
      task["componentKey"] !== projectKey ||
      task["type"] !== "REPORT" ||
      task["status"] !== "SUCCESS" ||
      typeof task["analysisId"] !== "string" ||
      !/^[A-Za-z0-9_-]{1,200}$/u.test(task["analysisId"]) ||
      typeof task["submittedAt"] !== "string" ||
      typeof task["executedAt"] !== "string" ||
      !(Date.parse(task["submittedAt"]) >= Date.parse(submission.startedAt)) ||
      !(Date.parse(task["executedAt"]) >= Date.parse(task["submittedAt"])) ||
      !(Date.parse(task["executedAt"]) <= now())
    ) {
      return { status: "deferred" };
    }

    const readPull = async () => {
      const matches = list((await get(prPath))["pullRequests"])
        .map(record)
        .filter((pull) => pull["key"] === String(submission.pullNumber));
      const pull = matches[0];
      if (
        matches.length !== 1 ||
        !pull ||
        pull["branch"] !== submission.sourceBranch ||
        pull["base"] !== "main" ||
        pull["target"] !== "main" ||
        record(pull["commit"])["sha"] !== submission.headSha ||
        record(pull["status"])["qualityGateStatus"] !== "OK" ||
        typeof pull["analysisDate"] !== "string" ||
        !(
          Date.parse(pull["analysisDate"]) >=
          Date.parse(task["submittedAt"] as string)
        ) ||
        !(
          Date.parse(pull["analysisDate"]) <=
          Date.parse(task["executedAt"] as string)
        )
      ) {
        throw new Error("SONAR_PULL_UNVERIFIED");
      }
      return pull;
    };
    const pull = await readPull();
    const assignmentPath = `qualitygates/get_by_project?organization=oxelio&project=${projectKey}`;
    const definitionPath = "qualitygates/show?organization=oxelio&id=9";
    const assignment = record((await get(assignmentPath))["qualityGate"]);
    const definition = await get(definitionPath);
    if (
      String(assignment["id"]) !== "9" ||
      String(definition["id"]) !== "9" ||
      digest(conditionTuples(definition["conditions"], false)) !==
        sonarGateConditionsDigest
    ) {
      return { status: "deferred" };
    }
    const status = record(
      (
        await get(
          `qualitygates/project_status?analysisId=${encodeURIComponent(task["analysisId"])}`,
        )
      )["projectStatus"],
    );
    if (
      status["status"] !== "OK" ||
      status["ignoredConditions"] !== false ||
      digest(conditionTuples(status["conditions"], true)) !==
        sonarGateConditionsDigest
    ) {
      return { status: "deferred" };
    }

    // Detect provider replacement, policy drift, candidate changes, producer
    // revocation and receipt expiry before returning a read-only observation.
    if (
      !isDeepStrictEqual(task, (await get(taskPath))["task"]) ||
      !isDeepStrictEqual(pull, await readPull()) ||
      !isDeepStrictEqual(
        assignment,
        (await get(assignmentPath))["qualityGate"],
      ) ||
      !isDeepStrictEqual(definition, await get(definitionPath)) ||
      !isDeepStrictEqual(submission, await input.readTrustedSubmission()) ||
      !matchesSubmission(await input.readCandidate(), submission) ||
      !(Date.parse(submission.expiresAt) > now())
    ) {
      return { status: "deferred" };
    }

    return {
      status: "verified",
      submission,
      analysisId: task["analysisId"],
      factsDigest: digest({
        submission,
        task,
        pull,
        assignment,
        definition,
        status,
      }),
    };
  } catch {
    // Never include provider bodies, URLs supplied by candidates, tokens or
    // diagnostic errors in evidence or logs.
    return { status: "deferred" };
  }
}
