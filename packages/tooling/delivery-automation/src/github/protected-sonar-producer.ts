import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  type ProtectedSonarSubmission,
  type SonarCandidate,
  sonarGateConditionsDigest,
} from "./sonar-analysis-evidence.js";

const projectKey = "Oxelio_architecture-web";
const sha = /^[a-f0-9]{40}$/u;

interface ProducerInput {
  readonly enabled?: boolean;
  readonly candidate: SonarCandidate;
  readonly producerRunId: number;
  readonly controlSha: string;
  readonly expiresAt: string;
  readonly scannerDistributionDigest: string;
  readonly sourceContextDigest: string;
  readonly now?: () => number;
  readonly readCandidate: () => Promise<SonarCandidate | null>;
  // Verify accepted producer operation, exact trusted source material,
  // controller queue and absence/resolution of conflicting provider writes.
  readonly verifyBoundary: () => Promise<boolean>;
  readonly admitSubmission: (factsDigest: string) => Promise<number | null>;
  // Only the protected runner may implement this port. It executes a pinned
  // scanner against exact candidate data with a trusted settings file.
  readonly scan: (
    properties: Readonly<Record<string, string>>,
  ) => Promise<string>;
}

const properties = {
  "sonar.organization": "oxelio",
  "sonar.projectKey": projectKey,
  "sonar.host.url": "https://sonarcloud.io",
  "sonar.sources": "apps,packages,scripts",
  "sonar.tests": "apps,packages,scripts",
  "sonar.test.inclusions":
    "**/*.spec.ts,**/*.spec.tsx,**/*.spec.mjs,**/*.test.ts,**/*.test.tsx,**/*.test.mjs",
  "sonar.exclusions":
    "**/node_modules/**,**/dist/**,**/coverage/**,**/*.spec.ts,**/*.spec.tsx,**/*.spec.mjs,**/*.test.ts,**/*.test.tsx,**/*.test.mjs",
  "sonar.javascript.lcov.reportPaths": "coverage/lcov.info",
  "sonar.sourceEncoding": "UTF-8",
} as const;

function taskFromReport(report: string) {
  if (Buffer.byteLength(report, "utf8") > 8192) {
    return null;
  }
  const entries = new Map<string, string>();
  for (const line of report.split(/\r?\n/u).filter(Boolean)) {
    const boundary = line.indexOf("=");
    const key = line.slice(0, boundary);
    if (boundary < 1 || entries.has(key)) {
      return null;
    }
    entries.set(key, line.slice(boundary + 1));
  }
  const id = entries.get("ceTaskId");
  return id &&
    /^[A-Za-z0-9_-]{1,200}$/u.test(id) &&
    entries.get("projectKey") === projectKey &&
    entries.get("serverUrl") === "https://sonarcloud.io" &&
    entries.get("ceTaskUrl") === `https://sonarcloud.io/api/ce/task?id=${id}`
    ? id
    : null;
}

export async function produceProtectedSonarSubmission(
  input: ProducerInput,
): Promise<ProtectedSonarSubmission | null> {
  if (input.enabled !== true) {
    return null;
  }
  const now = input.now ?? Date.now;
  const { candidate } = input;
  try {
    if (
      candidate.repositoryId !== 1336937640 ||
      ![input.producerRunId, candidate.workNumber, candidate.pullNumber].every(
        (value) => Number.isSafeInteger(value) && value > 0,
      ) ||
      ![candidate.headSha, candidate.baseSha, input.controlSha].every((value) =>
        sha.test(value),
      ) ||
      ![input.scannerDistributionDigest, input.sourceContextDigest].every(
        (value) => /^[a-f0-9]{64}$/u.test(value),
      ) ||
      !Number.isFinite(Date.parse(input.expiresAt)) ||
      now() >= Date.parse(input.expiresAt) ||
      !/^[A-Za-z0-9_./-]{1,255}$/u.test(candidate.sourceBranch) ||
      !(await input.verifyBoundary()) ||
      !isDeepStrictEqual(await input.readCandidate(), candidate)
    ) {
      return null;
    }
    const settings = {
      ...properties,
      "sonar.scm.revision": candidate.headSha,
      "sonar.pullrequest.key": String(candidate.pullNumber),
      "sonar.pullrequest.branch": candidate.sourceBranch,
      "sonar.pullrequest.base": "main",
    };
    const scannerConfigDigest = createHash("sha256")
      .update(
        JSON.stringify([
          settings,
          input.scannerDistributionDigest,
          input.sourceContextDigest,
        ]),
      )
      .digest("hex");
    const admitted = await input.admitSubmission(scannerConfigDigest);
    if (
      admitted === null ||
      !Number.isFinite(admitted) ||
      !(await input.verifyBoundary()) ||
      !isDeepStrictEqual(await input.readCandidate(), candidate) ||
      now() >= Math.min(admitted, Date.parse(input.expiresAt))
    ) {
      return null;
    }
    const startedAt = new Date(now()).toISOString();
    const taskId = taskFromReport(await input.scan(settings));
    if (
      !taskId ||
      now() >= Date.parse(input.expiresAt) ||
      !(await input.verifyBoundary()) ||
      !isDeepStrictEqual(await input.readCandidate(), candidate)
    ) {
      return null;
    }
    return {
      ...candidate,
      projectKey,
      taskId,
      producerRunId: input.producerRunId,
      producerRunAttempt: 1,
      controlSha: input.controlSha,
      scannerConfigDigest,
      conditionsDigest: sonarGateConditionsDigest,
      startedAt,
      expiresAt: input.expiresAt,
    };
  } catch {
    // An uncertain submission still requires provider reconciliation. No
    // candidate-controlled report or unverified task becomes a receipt.
    return null;
  }
}
