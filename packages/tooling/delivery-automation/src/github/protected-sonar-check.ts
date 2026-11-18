import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  completeReservedGateCheck,
  observeReservedGateCheck,
  queueReservedGateCheck,
} from "./gate-check-publisher.js";
import {
  type ProtectedSonarArtifactBinding,
  readGitHubProtectedSonarSubmission,
} from "./protected-sonar-submission.js";
import {
  readSonarAnalysisEvidence,
  type SonarCandidate,
} from "./sonar-analysis-evidence.js";

const checkName = "Architecture Web / Sonar Quality Gate";
const digest = (values: unknown) =>
  createHash("sha256").update(JSON.stringify(values)).digest("hex");

type CheckConnection = Pick<
  PublicationInput,
  "candidate" | "source" | "checkToken" | "issuerAppId" | "githubFetch"
>;

function checkScope(input: CheckConnection) {
  return {
    repository: "Oxelio/architecture-web",
    checksToken: input.checkToken,
    expectedAppId: input.issuerAppId,
    name: checkName,
    headSha: input.candidate.headSha,
    reservationId: protectedSonarCheckExternalId(input.candidate, input.source),
    ...(input.githubFetch ? { fetchImpl: input.githubFetch } : {}),
  };
}

export async function queueProtectedSonarCheck(
  input: CheckConnection & {
    readonly enabled?: boolean;
    readonly verifyPublicationBoundary: () => Promise<boolean>;
    readonly readCandidate: () => Promise<SonarCandidate | null>;
    readonly admitQueue: (factsDigest: string) => Promise<number | null>;
  },
) {
  if (input.enabled !== true) {
    return null;
  }
  try {
    const scope = checkScope(input);
    const current = async () =>
      (await input.verifyPublicationBoundary()) &&
      isDeepStrictEqual(await input.readCandidate(), input.candidate);
    if (!(await current())) {
      return null;
    }
    const deadline = await input.admitQueue(
      digest([scope.reservationId, input.issuerAppId]),
    );
    if (
      deadline === null ||
      !Number.isFinite(deadline) ||
      !(await current()) ||
      Date.now() >= deadline
    ) {
      return null;
    }
    const queued = await queueReservedGateCheck(scope);
    return queued
      ? observeReservedGateCheck(scope, { state: "queued", checkId: queued.id })
      : null;
  } catch {
    return null;
  }
}

interface PublicationInput {
  readonly enabled?: boolean;
  readonly candidate: SonarCandidate;
  readonly source: ProtectedSonarArtifactBinding;
  readonly githubReadToken: string;
  readonly sonarReadToken: string;
  readonly checkToken: string;
  readonly issuerAppId: number;
  readonly checkId: number;
  readonly readCandidate: () => Promise<SonarCandidate | null>;
  // Recheck the separate accepted issuer, candidate and writer boundary.
  readonly verifyPublicationBoundary: () => Promise<boolean>;
  // Only the protected durable controller can admit completion of this exact
  // check/evidence tuple. An observed prior admission cannot be reused.
  readonly admitCompletion: (factsDigest: string) => Promise<number | null>;
  readonly githubFetch?: typeof fetch;
  readonly sonarFetch?: typeof fetch;
}

export function protectedSonarCheckExternalId(
  candidate: SonarCandidate,
  source: ProtectedSonarArtifactBinding,
) {
  return digest([
    checkName,
    candidate.repositoryId,
    candidate.workNumber,
    candidate.pullNumber,
    candidate.headSha,
    candidate.baseSha,
    candidate.sourceBranch,
    source.producerRunId,
    source.producerWorkflowId,
    source.controlSha,
    source.scannerConfigDigest,
    source.artifactId,
    source.archiveDigest,
  ]);
}

async function readEvidence(input: PublicationInput) {
  const source = () =>
    readGitHubProtectedSonarSubmission({
      enabled: true,
      githubReadToken: input.githubReadToken,
      binding: input.source,
      candidate: input.candidate,
      ...(input.githubFetch ? { fetchImpl: input.githubFetch } : {}),
    });
  // The immutable producer receipt binds the terminal CE observation.
  // The publisher reads only Browse-accessible provider endpoints.
  let loaded: Awaited<ReturnType<typeof source>> = null;
  return readSonarAnalysisEvidence({
    enabled: true,
    token: input.sonarReadToken,
    readTrustedSubmission: async () => {
      loaded = await source();
      return loaded?.task ? loaded.submission : null;
    },
    readCandidate: input.readCandidate,
    readAttestedTask: async () => loaded?.task ?? null,
    ...(input.sonarFetch ? { fetchImpl: input.sonarFetch } : {}),
  });
}

export async function completeProtectedSonarCheck(input: PublicationInput) {
  if (input.enabled !== true) {
    return { status: "inactive" } as const;
  }
  try {
    const tokens = [
      input.githubReadToken,
      input.sonarReadToken,
      input.checkToken,
    ];
    if (
      tokens.some((token) => !token.trim()) ||
      new Set(tokens).size !== tokens.length ||
      !(await input.verifyPublicationBoundary())
    ) {
      return { status: "deferred" } as const;
    }
    const externalId = protectedSonarCheckExternalId(
      input.candidate,
      input.source,
    );
    const scope = checkScope(input);
    const check = await completeReservedGateCheck({
      ...scope,
      checkId: input.checkId,
      title: "SonarQube Cloud Quality Gate passed",
      summary:
        "Verified the authenticated analysis for the exact pull request candidate.",
      beforePatch: async () => {
        const evidence = await readEvidence(input);
        if (
          evidence.status !== "verified" ||
          !(await input.verifyPublicationBoundary())
        ) {
          return null;
        }
        const admitted = await input.admitCompletion(
          digest([
            externalId,
            input.issuerAppId,
            input.checkId,
            evidence.factsDigest,
          ]),
        );
        if (
          admitted === null ||
          !(await input.verifyPublicationBoundary()) ||
          !isDeepStrictEqual(await input.readCandidate(), input.candidate)
        ) {
          return null;
        }
        return Math.min(admitted, Date.parse(evidence.submission.expiresAt));
      },
    });
    if (
      !check ||
      !(await observeReservedGateCheck(scope, {
        checkId: check.id,
        state: "completed",
      }))
    ) {
      return { status: "deferred" } as const;
    }
    return { status: "published", check } as const;
  } catch {
    return { status: "deferred" } as const;
  }
}
