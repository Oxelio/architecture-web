import type {
  ControlledWriteScope,
  ReservedWriteContext,
} from "../control/controlled-write.js";
import type { AuthoringOutcomeProof } from "./controlled-authoring-execution.js";
import {
  type createGitHubWorkReservationJournal,
  protectedSonarJournalRequestId,
} from "./github-work-reservation-journal.js";
import type { MergeCandidate } from "./work-merge-publisher.js";

type Journal = ReturnType<typeof createGitHubWorkReservationJournal>;
type Operation = Parameters<
  Journal["beginProtectedSonarOperation"]
>[0]["operation"];

interface ProtectedSonarContext {
  readonly scope: ControlledWriteScope;
  readonly reserved: ReservedWriteContext | null;
  readonly inventoryComplete: boolean;
  readonly authorityDigest: string;
  readonly expiresAt: number;
}

// A positive append is required to send a provider write. Recovery is read
// only. In particular, an absent CE task or an expired window never settles
// a possibly submitted analysis.
export function createProtectedSonarAdmission(input: {
  readonly enabled?: boolean;
  readonly journal: Pick<
    Journal,
    | "readAuthoringBoundary"
    | "beginProtectedSonarOperation"
    | "finishAuthoringWrite"
  >;
  readonly workflowSha: string;
  readonly candidate: MergeCandidate;
  readonly operation: Operation;
  readonly operationId: string;
  readonly maximumHistoryRevisions: number;
  readonly readContext: () => Promise<ProtectedSonarContext | null>;
  readonly authorizeRecovery: () => Promise<boolean>;
  readonly now?: () => number;
}) {
  const requestId = protectedSonarJournalRequestId(
    input.candidate,
    input.operation,
    input.operationId,
  );
  const now = input.now ?? Date.now;
  const readCurrent = async () => {
    const context = await input.readContext();
    return context &&
      Number.isFinite(context.expiresAt) &&
      now() < context.expiresAt
      ? context
      : null;
  };
  return {
    requestId,
    async admit(evidenceDigest: string): Promise<number | null> {
      if (input.enabled !== true) {
        return null;
      }
      const boundary = await input.journal.readAuthoringBoundary();
      const context = await readCurrent();
      if (!context) {
        return null;
      }
      const admitted = await input.journal.beginProtectedSonarOperation({
        ...context,
        enabled: true,
        previous: boundary.position,
        workflowSha: input.workflowSha,
        candidate: input.candidate,
        operation: input.operation,
        operationId: input.operationId,
        evidenceDigest,
        maximumHistoryRevisions: input.maximumHistoryRevisions,
        readAuthority: async () =>
          (await readCurrent())?.authorityDigest ?? null,
      });
      const current =
        admitted.status === "admitted" ? await readCurrent() : null;
      return current?.authorityDigest === context.authorityDigest
        ? Math.min(context.expiresAt, current.expiresAt)
        : null;
    },
    async settle(
      evidenceDigest: string,
      observe: () => Promise<AuthoringOutcomeProof | null>,
    ) {
      return input.journal.finishAuthoringWrite({
        enabled: input.enabled === true,
        requestId,
        maximumHistoryRevisions: input.maximumHistoryRevisions,
        authorizeRecovery: input.authorizeRecovery,
        observeOutcome: ({ intent }) =>
          intent.scope.kind === input.operation &&
          intent.beforeStateDigest === evidenceDigest
            ? observe()
            : Promise.resolve(null),
      });
    },
  };
}
