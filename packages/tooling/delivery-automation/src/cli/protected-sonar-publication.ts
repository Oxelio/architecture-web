import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import { createAuthoringControlVerifier } from "../github/authoring-control-revision.js";
import { verifyControllerInstallation } from "../github/controller-installation.js";
import { observeReservedGateCheck } from "../github/gate-check-publisher.js";
import {
  createGitHubWorkReservationJournal,
  protectedSonarJournalRequestId,
} from "../github/github-work-reservation-journal.js";
import { createProtectedSonarAdmission } from "../github/protected-sonar-admission.js";
import {
  completeProtectedSonarCheck,
  protectedSonarCheckScope,
  protectedSonarQueueDigest,
  queueProtectedSonarCheck,
  readProtectedSonarCompletion,
} from "../github/protected-sonar-check.js";
import {
  readGitHubProtectedSonarSubmission,
  readGitHubProtectedSonarSubmissionForRecovery,
} from "../github/protected-sonar-submission.js";
import { readProtectedSonarTaskSettlement } from "../github/protected-sonar-task-settlement.js";
import { readAuthorizedWorkIntegrationTarget } from "../github/work-integration-target.js";
import {
  positiveInteger,
  requiredEnvironment,
} from "./gate-publication-support.js";
import {
  readProtectedRuntime,
  requireProtectedDispatch,
} from "./protected-runtime.js";
import {
  githubRepositoryRequest,
  readDirectMaintainerRecord,
} from "./work-pilot-support.js";

const sha = z.string().regex(/^[a-f0-9]{40}$/u);
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const id = z.number().int().positive();
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const publication = z.strictObject({
  kind: z.literal("protected-sonar-publication"),
  actorId: id,
  approvedControlRevision: sha,
  expiresAt: z.iso.datetime(),
  issuerAppId: id.refine(
    (value) => ![12526, 15368, 5625775, 5781545].includes(value),
  ),
  issuerAppSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  issuerInstallationId: id,
  candidate: z.strictObject({
    repositoryId: z.literal(1336937640),
    workNumber: id,
    pullNumber: id,
    headSha: sha,
    baseSha: sha,
    sourceBranch: z.string().regex(/^[A-Za-z0-9_./-]{1,255}$/u),
  }),
  source: z.strictObject({
    producerRunId: id,
    producerWorkflowId: id,
    controlSha: sha,
    scannerConfigDigest: hash,
    artifactId: id,
    archiveDigest: hash,
  }),
});

type Publication = z.infer<typeof publication>;

async function readChannel() {
  const commentId = positiveInteger("DELIVERY_SONAR_PUBLICATION_COMMENT_ID");
  const readApproval = async () =>
    publication.safeParse(await readDirectMaintainerRecord(commentId, 140));
  const parsed = await readApproval();
  if (
    !parsed.success ||
    parsed.data.actorId !== positiveInteger("GITHUB_ACTOR_ID") ||
    parsed.data.source.controlSha !== parsed.data.candidate.baseSha ||
    Date.parse(parsed.data.expiresAt) <= Date.now()
  ) {
    return null;
  }
  return {
    authority: parsed.data,
    readCurrent: async () => {
      const current = await readApproval();
      return (
        current.success &&
        isDeepStrictEqual(current.data, parsed.data) &&
        Date.parse(current.data.expiresAt) > Date.now()
      );
    },
  };
}

function readCandidateFor(authority: Publication, repositoryToken: string) {
  return async () => {
    const { candidate } = authority;
    const [resolution, base] = await Promise.all([
      readAuthorizedWorkIntegrationTarget({
        repository: "Oxelio/architecture-web",
        workNumber: candidate.workNumber,
        repositoryToken,
        active: true,
      }),
      githubRepositoryRequest<{ commit: { sha: string } }>("/branches/main"),
    ]);
    return resolution.status === "selected" &&
      resolution.target.pullRequestNumber === candidate.pullNumber &&
      resolution.target.headSha === candidate.headSha &&
      resolution.target.headRef === candidate.sourceBranch &&
      resolution.target.baseRef === "main" &&
      base.commit.sha === candidate.baseSha
      ? candidate
      : null;
  };
}

async function run() {
  if (process.env["DELIVERY_PROTECTED_SONAR_ENABLED"] !== "true") {
    return "inactive";
  }
  requireProtectedDispatch("delivery-protected-sonar-publication.yml");
  const stage = z.enum(["admit", "publish", "settle"]).parse(process.argv[2]);
  const action = z
    .enum(["queue", "complete", "reconcile-analysis"])
    .parse(process.env["SONAR_CHECK_OPERATION"]);
  const channel = await readChannel();
  if (!channel) {
    return "unverified";
  }
  const { authority } = channel;
  const { candidate, source, issuerAppId } = authority;
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const workflowSha = requiredEnvironment("TRUSTED_WORKFLOW_SHA");
  const verifyControl = createAuthoringControlVerifier({
    approvedRevision: authority.approvedControlRevision,
    readToken: repositoryToken,
  });
  const readCandidate = readCandidateFor(authority, repositoryToken);
  const verifyControlBoundary = async () =>
    (await channel.readCurrent()) && (await verifyControl(workflowSha));
  const verifyBoundary = async () =>
    (await verifyControlBoundary()) &&
    workflowSha === candidate.baseSha &&
    (await readCandidate()) !== null;
  const recovering = action === "reconcile-analysis";
  if (!(await (recovering ? verifyControlBoundary : verifyBoundary)())) {
    return "unverified";
  }
  const currentRunId = positiveInteger("GITHUB_RUN_ID");
  const operation = {
    queue: "sonar-queue-check",
    complete: "sonar-complete-check",
    "reconcile-analysis": "sonar-submit",
  } as const;
  const journalOperation = operation[action];
  const operationId =
    action === "reconcile-analysis"
      ? digest([source.producerRunId, source.controlSha])
      : digest([currentRunId, workflowSha, action, authority]);
  const requestId = protectedSonarJournalRequestId(
    candidate,
    journalOperation,
    operationId,
  );
  const checkId =
    action === "complete" ? positiveInteger("SONAR_CHECK_ID") : null;
  const githubReadToken = repositoryToken;
  const observation = {
    candidate,
    source,
    issuerAppId,
    checkToken: githubReadToken,
  };
  const expiry = Date.parse(authority.expiresAt);
  const checkState = checkId
    ? { state: "completed" as const, checkId }
    : { state: "queued" as const };

  if (stage === "publish") {
    const accepted = requiredEnvironment("SONAR_ADMITTED_DIGEST");
    const deadline = positiveInteger("SONAR_ADMITTED_UNTIL");
    const checkToken = requiredEnvironment("SONAR_CHECK_TOKEN");
    if (
      !hash.safeParse(accepted).success ||
      deadline > expiry ||
      checkToken === githubReadToken ||
      positiveInteger("SONAR_CHECK_INSTALLATION_ID") !==
        authority.issuerInstallationId
    ) {
      return "unverified";
    }
    const issuer = await verifyControllerInstallation({
      token: checkToken,
      appSlug: requiredEnvironment("SONAR_CHECK_APP_SLUG"),
      expectedAppSlug: authority.issuerAppSlug,
      installationId: positiveInteger("SONAR_CHECK_INSTALLATION_ID"),
      expectedInstallationId: authority.issuerInstallationId,
      expectedAppId: issuerAppId,
    });
    if (!issuer) {
      return "unverified";
    }
    const journal = createGitHubWorkReservationJournal({ repositoryToken });
    const verifyPublicationBoundary = async () =>
      Date.now() < deadline &&
      (await verifyBoundary()) &&
      (await journal.readAuthoringBoundary()).authoring.some(
        ({ intent }) =>
          intent.requestId === requestId &&
          intent.scope.kind === journalOperation &&
          intent.beforeStateDigest === accepted,
      );
    const admit = async (factsDigest: string) =>
      factsDigest === accepted && (await verifyPublicationBoundary())
        ? deadline
        : null;
    if (!checkId) {
      return (await queueProtectedSonarCheck({
        ...observation,
        checkToken,
        enabled: true,
        readCandidate,
        verifyPublicationBoundary,
        admitQueue: admit,
      }))
        ? "published"
        : "unverified";
    }
    const result = await completeProtectedSonarCheck({
      ...observation,
      checkToken,
      checkId,
      enabled: true,
      readCandidate,
      githubReadToken,
      sonarReadToken: requiredEnvironment("SONAR_BROWSE_TOKEN"),
      verifyPublicationBoundary,
      admitCompletion: admit,
    });
    return result.status === "published" ? "published" : "unverified";
  }
  const runtime = await readProtectedRuntime(authority.approvedControlRevision);
  if (!runtime?.activation.workIntegrationPr || !(await runtime.verify())) {
    return "unverified";
  }
  const journal = createGitHubWorkReservationJournal({
    repositoryToken: runtime.mergeToken,
  });
  const admission = createProtectedSonarAdmission({
    enabled: true,
    journal,
    workflowSha,
    candidate,
    operation: journalOperation,
    operationId,
    maximumHistoryRevisions: positiveInteger(
      "DELIVERY_AUTHORING_MAXIMUM_HISTORY_REVISIONS",
    ),
    readContext: async () => {
      if (!(await verifyBoundary()) || !(await runtime.verify())) {
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
          kind: journalOperation,
          affectedWorks: [candidate.workNumber],
          affectedPulls: [candidate.pullNumber],
          affectedRefs: ["refs/heads/main"],
        },
        inventoryComplete: true,
        reserved: null,
        authorityDigest: digest(authority),
        expiresAt: expiry,
      };
    },
    authorizeRecovery: async () =>
      (await (recovering ? verifyControlBoundary : verifyBoundary)()) &&
      runtime.verify(),
  });
  if (action === "reconcile-analysis") {
    if (stage !== "admit") {
      return "unverified";
    }
    const receipt = await readGitHubProtectedSonarSubmissionForRecovery({
      enabled: true,
      githubReadToken,
      binding: source,
      candidate,
    });
    if (!receipt) {
      return "unverified";
    }
    const result = await admission.settle(source.scannerConfigDigest, () =>
      readProtectedSonarTaskSettlement({
        token: requiredEnvironment("SONAR_BROWSE_TOKEN"),
        readTrustedSubmission: async () => receipt.submission,
      }),
    );
    // No positive job outputs, so no publisher or second settlement runs.
    return result === "settled" || result === "already-settled"
      ? "settled"
      : "unverified";
  }
  if (stage === "settle") {
    const evidenceDigest = requiredEnvironment("SONAR_ADMITTED_DIGEST");
    const result = await admission.settle(evidenceDigest, async () => {
      const observed = await observeReservedGateCheck(
        protectedSonarCheckScope(observation),
        checkState,
      );
      return observed
        ? { outcome: "confirmed", proofDigest: digest(observed) }
        : null;
    });
    return result === "settled" || result === "already-settled"
      ? "settled"
      : "unverified";
  }
  const submission = await readGitHubProtectedSonarSubmission({
    enabled: true,
    githubReadToken,
    binding: source,
    candidate,
  });
  if (!submission) {
    return "unverified";
  }
  let factsDigest = protectedSonarQueueDigest(observation);
  let until = Math.min(expiry, Date.parse(submission.submission.expiresAt));
  if (checkId) {
    const scope = protectedSonarCheckScope(observation);
    if (
      !(await observeReservedGateCheck(scope, { state: "queued", checkId }))
    ) {
      return "unverified";
    }
    const completion = await readProtectedSonarCompletion({
      ...observation,
      githubReadToken,
      readCandidate,
      checkId,
      sonarReadToken: requiredEnvironment("SONAR_BROWSE_TOKEN"),
    });
    if (!completion) {
      return "unverified";
    }
    factsDigest = completion.factsDigest;
    until = Math.min(until, completion.expiresAt);
  }
  if (Date.now() >= until) {
    return "unverified";
  }
  const admitted = await admission.admit(factsDigest);
  if (admitted === null) {
    return "unverified";
  }
  await appendFile(
    requiredEnvironment("GITHUB_OUTPUT"),
    `digest=${factsDigest}\nuntil=${Math.min(admitted, until)}\n`,
  );
  return "admitted";
}

try {
  const result = await run();
  console.log(JSON.stringify({ result }));
  if (result === "unverified") {
    process.exitCode = 1;
  }
} catch {
  console.error("PROTECTED_SONAR_PUBLICATION_UNVERIFIED");
  process.exitCode = 1;
}
