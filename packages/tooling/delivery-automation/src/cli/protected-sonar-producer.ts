import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import { createGitHubWorkReservationJournal } from "../github/github-work-reservation-journal.js";
import { createProtectedSonarAdmission } from "../github/protected-sonar-admission.js";
import { produceProtectedSonarSubmission } from "../github/protected-sonar-producer.js";
import { createProtectedSonarScanner } from "../github/protected-sonar-scanner.js";
import {
  readProtectedSonarTaskObservation,
  readProtectedSonarTaskSettlement,
} from "../github/protected-sonar-task-settlement.js";
import { readAuthorizedWorkIntegrationTarget } from "../github/work-integration-target.js";
import {
  positiveInteger,
  requiredEnvironment,
} from "./gate-publication-support.js";
import {
  readProtectedRuntime,
  requireProtectedDispatch,
} from "./protected-runtime.js";
import { readDirectMaintainerRecord } from "./work-pilot-support.js";

const sha = z.string().regex(/^[a-f0-9]{40}$/u);
const id = z.number().int().positive();
const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

const approval = z.strictObject({
  kind: z.literal("protected-sonar-producer"),
  repositoryId: z.literal(1336937640),
  actorId: id,
  approvedControlRevision: sha,
  expiresAt: z.iso.datetime(),
  workNumber: id,
  pullNumber: id,
  headSha: sha,
  baseSha: sha,
  scannerDistributionDigest: z.string().regex(/^[a-f0-9]{64}$/u),
});

async function run() {
  if (process.env["DELIVERY_PROTECTED_SONAR_ENABLED"] !== "true") {
    return "inactive";
  }
  requireProtectedDispatch("delivery-protected-sonar.yml");
  const commentId = positiveInteger("DELIVERY_SONAR_PRODUCER_COMMENT_ID");
  const readApproval = async () =>
    approval.safeParse(await readDirectMaintainerRecord(commentId, 140));
  const parsed = await readApproval();
  if (!parsed.success) {
    return "unverified";
  }
  const authority = parsed.data;
  const expiresAt = Date.parse(authority.expiresAt);
  const producerRunId = positiveInteger("GITHUB_RUN_ID");
  const baseSha = requiredEnvironment("SONAR_BASE_SHA");
  const runtime = await readProtectedRuntime(authority.approvedControlRevision);
  if (
    !runtime ||
    authority.actorId !== positiveInteger("GITHUB_ACTOR_ID") ||
    authority.headSha !== requiredEnvironment("SONAR_HEAD_SHA") ||
    authority.baseSha !== baseSha ||
    runtime.workflowSha !== baseSha ||
    authority.scannerDistributionDigest !==
      requiredEnvironment("SCANNER_DIGEST") ||
    Date.now() >= expiresAt
  ) {
    return "unverified";
  }
  const journal = createGitHubWorkReservationJournal({
    repositoryToken: runtime.mergeToken,
  });
  const readCandidate = async () => {
    const resolution = await readAuthorizedWorkIntegrationTarget({
      repository: runtime.repository,
      repositoryToken: runtime.repositoryToken,
      workNumber: authority.workNumber,
      active: runtime.activation.workIntegrationPr,
    });
    if (
      resolution.status !== "selected" ||
      resolution.target.pullRequestNumber !== authority.pullNumber ||
      resolution.target.baseRef !== "main" ||
      resolution.target.headSha !== authority.headSha
    ) {
      return null;
    }
    return {
      repositoryId: authority.repositoryId,
      workNumber: authority.workNumber,
      pullNumber: authority.pullNumber,
      headSha: authority.headSha,
      baseSha,
      sourceBranch: resolution.target.headRef,
    };
  };
  const candidate = await readCandidate();
  if (!candidate) {
    return "unverified";
  }
  const verifyBoundary = async () => {
    const current = await readApproval();
    return (
      current.success &&
      isDeepStrictEqual(current.data, authority) &&
      Date.now() < expiresAt &&
      (await runtime.verify())
    );
  };
  const admission = createProtectedSonarAdmission({
    enabled: true,
    journal,
    workflowSha: runtime.workflowSha,
    candidate,
    operation: "sonar-submit",
    operationId: digest(JSON.stringify([producerRunId, runtime.workflowSha])),
    maximumHistoryRevisions: positiveInteger(
      "DELIVERY_AUTHORING_MAXIMUM_HISTORY_REVISIONS",
    ),
    // Treat a provider submission as conflicting with any unresolved native
    // reservation. This producer has no cancellation authority.
    readContext: async () => {
      if (
        !(await verifyBoundary()) ||
        !isDeepStrictEqual(candidate, await readCandidate())
      ) {
        return null;
      }
      const { reservation } = await journal.readAuthoringBoundary();
      if (
        reservation &&
        !["merged", "cancelled", "invalidated"].includes(
          reservation.reservation.state.phase,
        )
      ) {
        return null;
      }
      return {
        scope: {
          repositoryId: candidate.repositoryId,
          kind: "sonar-submit",
          affectedWorks: [candidate.workNumber],
          affectedPulls: [candidate.pullNumber],
          affectedRefs: ["refs/heads/main"],
        },
        reserved: null,
        inventoryComplete: true,
        authorityDigest: digest(JSON.stringify(authority)),
        expiresAt,
      };
    },
    authorizeRecovery: verifyBoundary,
  });
  const candidateDirectory = requiredEnvironment("SONAR_CANDIDATE_DIRECTORY");
  const coverage = join(candidateDirectory, "coverage", "lcov.info");
  const metadata = await lstat(coverage);
  if (
    !metadata.isFile() ||
    metadata.size === 0 ||
    metadata.size > 32 * 1024 * 1024
  ) {
    return "unverified";
  }
  const bytes = await readFile(coverage);
  const coveragePaths = [...bytes.toString("utf8").matchAll(/^SF:(.*)$/gmu)];
  if (
    coveragePaths.length === 0 ||
    coveragePaths.some(
      ([, path]) =>
        !path ||
        !/^(?:apps|packages|scripts)\/[\w./-]+$/u.test(path) ||
        path.split("/").some((segment) => ["", ".", ".."].includes(segment)),
    )
  ) {
    return "unverified";
  }
  const analysisToken = requiredEnvironment("SONAR_ANALYSIS_TOKEN");
  const browseToken = requiredEnvironment("SONAR_BROWSE_TOKEN");
  if (analysisToken === browseToken) {
    return "unverified";
  }
  const scan = createProtectedSonarScanner({
    executable: requiredEnvironment("SONAR_SCANNER_EXECUTABLE"),
    candidateDirectory,
    privateTemporaryRoot: requiredEnvironment("RUNNER_TEMP"),
    analysisToken,
  });
  const submission = await produceProtectedSonarSubmission({
    enabled: true,
    candidate,
    producerRunId,
    controlSha: runtime.workflowSha,
    expiresAt: authority.expiresAt,
    scannerDistributionDigest: authority.scannerDistributionDigest,
    sourceContextDigest: digest(bytes),
    verifyBoundary,
    readCandidate,
    admitSubmission: admission.admit,
    scan,
  });
  if (!submission) {
    return "unverified";
  }
  const observe = {
    token: browseToken,
    readTrustedSubmission: async () => submission,
  };
  let result = await readProtectedSonarTaskObservation(observe);
  for (let check = 0; !result && check < 6; check += 1) {
    await setTimeout(5000);
    result = await readProtectedSonarTaskObservation(observe);
  }
  // Persist the receipt even if the provider has not yet finished or the
  // settlement response is lost. Absence of a task never releases the scope.
  await writeFile(
    join(requiredEnvironment("RUNNER_TEMP"), "submission.json"),
    JSON.stringify({ submission, task: result?.task ?? null }),
    { flag: "wx", mode: 0o600 },
  );
  if (result) {
    await admission.settle(submission.scannerConfigDigest, () =>
      readProtectedSonarTaskSettlement(observe),
    );
  }
  return "recorded";
}

try {
  const result = await run();
  console.log(JSON.stringify({ result }));
  if (result !== "recorded" && result !== "inactive") {
    process.exitCode = 1;
  }
} catch {
  console.error("PROTECTED_SONAR_PRODUCER_UNVERIFIED");
  process.exitCode = 1;
}
