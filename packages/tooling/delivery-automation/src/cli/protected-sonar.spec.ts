import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { createGitHubWorkReservationJournal } from "../github/github-work-reservation-journal.js";
import type {
  completeProtectedSonarCheck,
  queueProtectedSonarCheck,
} from "../github/protected-sonar-check.js";

type Journal = ReturnType<typeof createGitHubWorkReservationJournal>;
const mock = vi.hoisted(() => ({
  approval: vi.fn(),
  target: vi.fn(),
  branch: vi.fn(),
  dispatch: vi.fn(),
  verifyControl: vi.fn(),
  verifyRuntime: vi.fn(),
  runtime: vi.fn(),
  readBoundary: vi.fn(),
  begin: vi.fn<Journal["beginProtectedSonarOperation"]>(),
  settle: vi.fn<Journal["finishAuthoringWrite"]>(),
  coverageFile: vi.fn(),
  coverage: vi.fn(),
  write: vi.fn(),
  output: vi.fn(),
  delay: vi.fn(),
  scan: vi.fn(),
  observation: vi.fn(),
  taskSettlement: vi.fn(),
  installation: vi.fn(),
  check: vi.fn(),
  queue: vi.fn<typeof queueProtectedSonarCheck>(),
  complete: vi.fn<typeof completeProtectedSonarCheck>(),
  completion: vi.fn(),
  submission: vi.fn(),
  recoveryReceipt: vi.fn(),
}));

vi.mock(import("node:fs/promises"), async (original) => ({
  ...(await original()),
  lstat: mock.coverageFile,
  readFile: mock.coverage,
  writeFile: mock.write,
  appendFile: mock.output,
}));
vi.mock(import("node:timers/promises"), async (original) => ({
  ...(await original()),
  setTimeout: mock.delay,
}));
vi.mock(import("./protected-runtime.js"), () => ({
  readProtectedRuntime: mock.runtime,
  requireProtectedDispatch: mock.dispatch,
}));
vi.mock(import("./work-pilot-support.js"), async (original) => ({
  ...(await original()),
  readDirectMaintainerRecord: mock.approval,
  githubRepositoryRequest: mock.branch,
}));
vi.mock("../github/github-work-reservation-journal.js", async () => ({
  ...(await vi.importActual<
    typeof import("../github/github-work-reservation-journal.js")
  >("../github/github-work-reservation-journal.js")),
  createGitHubWorkReservationJournal: () => ({
    readAuthoringBoundary: mock.readBoundary,
    beginProtectedSonarOperation: mock.begin,
    finishAuthoringWrite: mock.settle,
  }),
}));
vi.mock(import("../github/work-integration-target.js"), () => ({
  readAuthorizedWorkIntegrationTarget: mock.target,
}));
vi.mock(import("../github/authoring-control-revision.js"), () => ({
  createAuthoringControlVerifier: () => mock.verifyControl,
}));
vi.mock(import("../github/controller-installation.js"), () => ({
  verifyControllerInstallation: mock.installation,
}));
vi.mock(import("../github/protected-sonar-scanner.js"), () => ({
  createProtectedSonarScanner: () => mock.scan,
}));
vi.mock(import("../github/protected-sonar-task-settlement.js"), () => ({
  readProtectedSonarTaskObservation: mock.observation,
  readProtectedSonarTaskSettlement: mock.taskSettlement,
}));
vi.mock(import("../github/gate-check-publisher.js"), () => ({
  observeReservedGateCheck: mock.check,
}));
vi.mock(import("../github/protected-sonar-check.js"), async (original) => ({
  ...(await original()),
  queueProtectedSonarCheck: mock.queue,
  completeProtectedSonarCheck: mock.complete,
  readProtectedSonarCompletion: mock.completion,
}));
vi.mock(
  import("../github/protected-sonar-submission.js"),
  async (original) => ({
    ...(await original()),
    readGitHubProtectedSonarSubmission: mock.submission,
    readGitHubProtectedSonarSubmissionForRecovery: mock.recoveryReceipt,
  }),
);

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const hash = "c".repeat(64);
const scannerHash = "d".repeat(64);
const now = Date.parse("2026-11-18T12:00:00Z");
const expiresAt = "2026-11-18T13:00:00.000Z";
const deadline = Date.parse(expiresAt);
const candidate = {
  repositoryId: 1336937640,
  workNumber: 140,
  pullNumber: 147,
  headSha,
  baseSha,
  sourceBranch: "codex/fixture",
};
const target = {
  status: "selected",
  target: {
    pullRequestNumber: 147,
    headSha,
    headRef: candidate.sourceBranch,
    baseRef: "main",
  },
};
const producer = {
  kind: "protected-sonar-producer",
  repositoryId: candidate.repositoryId,
  workNumber: candidate.workNumber,
  pullNumber: candidate.pullNumber,
  actorId: 43,
  approvedControlRevision: baseSha,
  expiresAt,
  headSha,
  baseSha,
  scannerDistributionDigest: scannerHash,
};
const publication = {
  kind: "protected-sonar-publication",
  actorId: 43,
  approvedControlRevision: baseSha,
  expiresAt,
  issuerAppId: 445,
  issuerAppSlug: "fixture-checks",
  issuerInstallationId: 446,
  candidate,
  source: {
    producerRunId: 54,
    producerWorkflowId: 55,
    controlSha: baseSha,
    scannerConfigDigest: scannerHash,
    artifactId: 56,
    archiveDigest: hash,
  },
};
const receipt = {
  submission: { ...candidate, expiresAt },
  task: { id: "ce-1" },
};
const observedCheck = { id: 13 };
let previousArgv: string[];
let previousExitCode: typeof process.exitCode;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  previousArgv = process.argv;
  previousExitCode = process.exitCode;
  process.exitCode = undefined;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const [name, value] of Object.entries({
    DELIVERY_PROTECTED_SONAR_ENABLED: "true",
    DELIVERY_SONAR_PRODUCER_COMMENT_ID: "51",
    DELIVERY_SONAR_PUBLICATION_COMMENT_ID: "52",
    DELIVERY_AUTHORING_MAXIMUM_HISTORY_REVISIONS: "50",
    GITHUB_TOKEN: "fixture-read",
    GITHUB_ACTOR_ID: "43",
    GITHUB_RUN_ID: "54",
    TRUSTED_WORKFLOW_SHA: baseSha,
    GITHUB_OUTPUT: "/fixture/job-output",
    RUNNER_TEMP: "/fixture",
    SCANNER_DIGEST: scannerHash,
    SONAR_CANDIDATE_DIRECTORY: "/fixture/candidate",
    SONAR_SCANNER_EXECUTABLE: "/fixture/scanner",
    SONAR_HEAD_SHA: headSha,
    SONAR_BASE_SHA: baseSha,
    SONAR_ANALYSIS_TOKEN: "fixture-analysis",
    SONAR_BROWSE_TOKEN: "fixture-browse",
    SONAR_CHECK_INSTALLATION_ID: "446",
    SONAR_CHECK_APP_SLUG: "fixture-checks",
    SONAR_CHECK_TOKEN: "fixture-check",
    SONAR_CHECK_ID: "13",
    SONAR_ADMITTED_DIGEST: hash,
    SONAR_ADMITTED_UNTIL: String(deadline),
  })) {
    vi.stubEnv(name, value);
  }
  mock.approval.mockImplementation(async (id: number) =>
    id === 51 ? producer : publication,
  );
  mock.verifyRuntime.mockResolvedValue(true);
  mock.verifyControl.mockResolvedValue(true);
  mock.runtime.mockResolvedValue({
    repository: "Oxelio/architecture-web",
    repositoryToken: "fixture-read",
    mergeToken: "fixture-controller",
    workflowSha: baseSha,
    activation: { workIntegrationPr: true },
    verify: mock.verifyRuntime,
  });
  mock.target.mockResolvedValue(target);
  mock.branch.mockResolvedValue({ commit: { sha: baseSha } });
  mock.readBoundary.mockResolvedValue({
    position: null,
    reservation: null,
    authoring: [],
  });
  mock.coverageFile.mockResolvedValue({ isFile: () => true, size: 35 });
  mock.coverage.mockResolvedValue(
    Buffer.from("SF:packages/source.ts\nDA:1,1\n"),
  );
  mock.scan.mockResolvedValue(
    [
      "projectKey=Oxelio_architecture-web",
      "serverUrl=https://sonarcloud.io",
      "ceTaskId=ce-1",
      "ceTaskUrl=https://sonarcloud.io/api/ce/task?id=ce-1",
    ].join("\n"),
  );
  mock.observation.mockResolvedValue(receipt);
  mock.taskSettlement.mockResolvedValue({
    outcome: "confirmed",
    proofDigest: hash,
  });
  mock.installation.mockResolvedValue({ botId: 123 });
  mock.check.mockResolvedValue(observedCheck);
  mock.submission.mockResolvedValue(receipt);
  mock.recoveryReceipt.mockResolvedValue(receipt);
  mock.completion.mockResolvedValue({ factsDigest: hash, expiresAt: deadline });
  mock.begin.mockImplementation(async (input) => {
    if ((await input.readAuthority()) !== input.authorityDigest) {
      return { status: "denied" };
    }
    return {
      status: "admitted",
      position: { revision: 1, tagSha: baseSha },
      admission: {
        admissionRevision: 1,
        intent: {
          schema: 1,
          requestId: hash,
          actorDigest: hash,
          commandDigest: hash,
          authorityDigest: input.authorityDigest,
          beforeStateDigest: input.evidenceDigest,
          scope: input.scope,
        },
      },
    };
  });
  mock.settle.mockImplementation(async (input) =>
    (await input.authorizeRecovery()) ? "settled" : "deferred",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.argv = previousArgv;
  process.exitCode = previousExitCode;
});

async function publish(stage: string, action: string, result: string) {
  vi.stubEnv("SONAR_CHECK_OPERATION", action);
  process.argv = ["node", "protected-sonar-publication.ts", stage];
  await import("./protected-sonar-publication.js");
  expect(console.log).toHaveBeenCalledWith(JSON.stringify({ result }));
}

async function produce(result: string) {
  await import("./protected-sonar-producer.js");
  expect(console.log).toHaveBeenCalledWith(JSON.stringify({ result }));
}

describe("Protected Sonar producer command", () => {
  it("keeps submission dormant by default", async () => {
    vi.stubEnv("DELIVERY_PROTECTED_SONAR_ENABLED", "");
    await produce("inactive");
    expect(mock.dispatch).not.toHaveBeenCalled();
  });

  it("scans only after admission and persists terminal provider evidence", async () => {
    mock.observation.mockResolvedValueOnce(null);
    await produce("recorded");
    expect(mock.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "sonar-submit",
        candidate,
      }),
    );
    expect(mock.begin.mock.invocationCallOrder[0]).toBeLessThan(
      mock.scan.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mock.scan).toHaveBeenCalledWith(
      expect.objectContaining({
        "sonar.pullrequest.key": "147",
        "sonar.scm.revision": headSha,
      }),
    );
    expect(mock.write).toHaveBeenCalledWith(
      expect.stringMatching(/submission\.json$/u),
      expect.stringContaining('"task":{"id":"ce-1"}'),
      { flag: "wx", mode: 0o600 },
    );
    expect(mock.settle).toHaveBeenCalledOnce();
  });

  it("keeps a non-terminal task pending without releasing the journal", async () => {
    mock.observation.mockResolvedValue(null);
    await produce("recorded");
    expect(mock.delay).toHaveBeenCalledTimes(6);
    expect(mock.write.mock.calls[0]?.[1]).toContain('"task":null');
    expect(mock.settle).not.toHaveBeenCalled();
  });

  it.each([
    "stale candidate",
    "armed merge",
    "unsafe LCOV",
    "wrong authority",
    "changed authority",
    "shared token",
  ])("withholds submission for %s", async (cause) => {
    if (cause === "stale candidate") {
      mock.target.mockResolvedValue({ status: "unavailable" });
    }
    if (cause === "armed merge") {
      mock.readBoundary.mockResolvedValue({
        reservation: { reservation: { state: { phase: "armed" } } },
      });
    }
    if (cause === "unsafe LCOV") {
      mock.coverage.mockResolvedValue(
        Buffer.from("SF:packages/../fixture.ts\n"),
      );
    }
    if (cause === "wrong authority") {
      mock.approval.mockResolvedValue(null);
    }
    if (cause === "changed authority") {
      mock.approval.mockResolvedValueOnce(producer).mockResolvedValue(null);
    }
    if (cause === "shared token") {
      vi.stubEnv("SONAR_BROWSE_TOKEN", "fixture-analysis");
    }
    await produce("unverified");
    expect(mock.scan).not.toHaveBeenCalled();
    expect(mock.write).not.toHaveBeenCalled();
  });
});

describe("Protected Sonar publication command", () => {
  it.each(["queue", "complete"])(
    "admits %s only for exact attested evidence",
    async (action) => {
      await publish("admit", action, "admitted");
      expect(mock.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: `sonar-${action}-check`,
          candidate,
        }),
      );
      expect(mock.output).toHaveBeenCalledWith(
        "/fixture/job-output",
        expect.stringMatching(/^digest=[a-f0-9]{64}\nuntil=\d+\n$/u),
      );
      expect(mock.complete).not.toHaveBeenCalled();
      expect(mock.queue).not.toHaveBeenCalled();
    },
  );

  it.each([
    "missing artifact",
    "missing queued check",
    "unverified analysis",
    "wrong base",
    "armed merge",
  ])("does not emit handoff evidence for %s", async (cause) => {
    if (cause === "missing artifact") {
      mock.submission.mockResolvedValue(null);
    }
    if (cause === "missing queued check") {
      mock.check.mockResolvedValue(null);
    }
    if (cause === "unverified analysis") {
      mock.completion.mockResolvedValue(null);
    }
    if (cause === "wrong base") {
      mock.branch.mockResolvedValue({ commit: { sha: headSha } });
    }
    if (cause === "armed merge") {
      mock.readBoundary.mockResolvedValue({
        reservation: { reservation: { state: { phase: "armed" } } },
      });
    }
    await publish("admit", "complete", "unverified");
    expect(mock.output).not.toHaveBeenCalled();
  });

  it.each(["queue", "complete"])(
    "requires the matching first-run journal handoff to %s",
    async (action) => {
      await publish("admit", action, "admitted");
      const admission = mock.begin.mock.calls[0]?.[0];
      if (!admission) {
        throw new Error("Missing fixture admission");
      }
      const { protectedSonarJournalRequestId } =
        await import("../github/github-work-reservation-journal.js");
      const requestId = protectedSonarJournalRequestId(
        candidate,
        admission.operation,
        admission.operationId,
      );
      mock.readBoundary.mockResolvedValue({
        authoring: [
          {
            intent: {
              requestId,
              scope: admission.scope,
              beforeStateDigest: admission.evidenceDigest,
            },
          },
        ],
      });
      vi.stubEnv("SONAR_ADMITTED_DIGEST", admission.evidenceDigest);
      if (action === "queue") {
        mock.queue.mockImplementation(async (input) =>
          (await input.verifyPublicationBoundary()) &&
          (await input.admitQueue(admission.evidenceDigest)) === deadline
            ? ({ id: 13 } as NonNullable<
                Awaited<ReturnType<typeof queueProtectedSonarCheck>>
              >)
            : null,
        );
      } else {
        mock.complete.mockImplementation(async (input) =>
          (await input.verifyPublicationBoundary()) &&
          (await input.admitCompletion(admission.evidenceDigest)) === deadline
            ? { status: "published", check: observedCheck as never }
            : { status: "deferred" },
        );
      }
      vi.resetModules();
      await publish("publish", action, "published");
      expect(mock.installation).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedAppId: 445,
          expectedInstallationId: 446,
        }),
      );
      expect(mock.begin).toHaveBeenCalledOnce();
    },
  );

  it("keeps a namesake App from publishing after admission", async () => {
    mock.installation.mockResolvedValue(null);
    await publish("publish", "complete", "unverified");
    expect(mock.complete).not.toHaveBeenCalled();
  });

  it("reconciles an older provider submission through a read-only observation", async () => {
    mock.branch.mockResolvedValue({ commit: { sha: headSha } });
    mock.settle.mockImplementation(async (input) => {
      const evidence = await input.observeOutcome({
        intent: {
          scope: { kind: "sonar-submit" },
          beforeStateDigest: scannerHash,
        },
      } as Parameters<typeof input.observeOutcome>[0]);
      return (await input.authorizeRecovery()) && evidence
        ? "settled"
        : "deferred";
    });
    await publish("admit", "reconcile-analysis", "settled");
    expect(mock.taskSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ token: "fixture-browse" }),
    );
    expect(mock.output).not.toHaveBeenCalled();
    expect(mock.begin).not.toHaveBeenCalled();
    expect(mock.complete).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "settles only when GitHub positively observes the check (%s)",
    async (observed) => {
      mock.check.mockResolvedValue(observed ? observedCheck : null);
      mock.settle.mockImplementation(async (input) => {
        const proof = await input.observeOutcome({
          intent: {
            scope: { kind: "sonar-complete-check" },
            beforeStateDigest: hash,
          },
        } as Parameters<typeof input.observeOutcome>[0]);
        return (await input.authorizeRecovery()) && proof
          ? "settled"
          : "deferred";
      });
      await publish("settle", "complete", observed ? "settled" : "unverified");
      expect(mock.check).toHaveBeenCalledWith(
        expect.objectContaining({ checksToken: "fixture-read" }),
        { checkId: 13, state: "completed" },
      );
      expect(mock.complete).not.toHaveBeenCalled();
    },
  );
});
