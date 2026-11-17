import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeEligibleStandingWorkIntegration } from "./eligible-standing-work-integration.js";
import {
  readReservedGitHubWorkIntegration,
  reconcileReservedGitHubWorkIntegration,
  recordReleasedNativeSquash,
} from "./reserved-work-integration.js";
import { runStandingWorkIntegration } from "./run-standing-work-integration.js";
import { verifyStandingJournalRules } from "./work-merge-publisher.js";

vi.mock("./eligible-standing-work-integration.js");
vi.mock("./reserved-work-integration.js");
vi.mock("./work-merge-publisher.js");

const candidate = {
  workNumber: 10,
  pullNumber: 20,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const repository = "Oxelio/architecture-web";
const repositoryId = 1336937640;
const controllerBotId = 42;
const context = {
  repository,
  repositoryId,
  ref: "refs/heads/main",
  runAttempt: "1",
  workflowSha: candidate.baseSha,
};
const delegation = {
  repositoryId,
  controllerBotId,
  workflowSha: candidate.baseSha,
  gatePublication: true,
  nativeSquash: true,
  expiresAt: "2099-01-01T00:00:00Z",
};
const execute = vi.mocked(executeEligibleStandingWorkIntegration);

function fixture() {
  const readDelegation = vi.fn(async () => delegation);
  const authorizeRecovery = vi.fn(async () => true);
  const input = {
    standingEnabled: true,
    candidate,
    context,
    readDelegation,
    authorizeRecovery,
    scope: {
      publisher: { repository, repositoryId, actorId: controllerBotId },
      controllerBotId,
    },
  } as unknown as Parameters<typeof runStandingWorkIntegration>[0];
  return { input, readDelegation, authorizeRecovery };
}

beforeEach(() => {
  vi.mocked(verifyStandingJournalRules).mockReset().mockResolvedValue(true);
  vi.mocked(readReservedGitHubWorkIntegration)
    .mockReset()
    .mockResolvedValue(null);
  vi.mocked(recordReleasedNativeSquash).mockReset().mockResolvedValue(null);
  vi.mocked(reconcileReservedGitHubWorkIntegration)
    .mockReset()
    .mockResolvedValue({ status: "deferred" });
  execute.mockReset();
  execute.mockImplementation(
    async ({ candidate: requestCandidate, operation, authorize }) => {
      if (!(await authorize({ candidate: requestCandidate, operation }))) {
        return { status: "denied" };
      }
      const state =
        operation === "queue-check"
          ? "queued"
          : operation === "arm-squash"
            ? "armed"
            : "released";
      return {
        status: "confirmed",
        receipt: {
          revision: 1,
          reservation: {
            candidate: requestCandidate,
            state: { phase: state, checkId: 17 },
          },
        },
      };
    },
  );
});

describe("protected standing integration sequence", () => {
  it("starts no action by default or from a non-main or replayed invocation", async () => {
    const { input, readDelegation } = fixture();
    expect(
      await runStandingWorkIntegration({ ...input, standingEnabled: false }),
    ).toEqual({ status: "inactive" });
    for (const change of [
      { ref: "refs/heads/topic" },
      { runAttempt: "2" },
      { workflowSha: candidate.headSha },
    ]) {
      expect(
        await runStandingWorkIntegration({
          ...input,
          context: { ...context, ...change },
        }),
      ).toEqual({ status: "denied" });
    }
    expect(execute).not.toHaveBeenCalled();
    expect(readDelegation).not.toHaveBeenCalled();
  });

  it("rejects an unverified journal before reading or reserving it", async () => {
    const { input } = fixture();
    vi.mocked(verifyStandingJournalRules).mockResolvedValue(false);
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "denied",
    });
    expect(readReservedGitHubWorkIntegration).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("rechecks the two delegated permissions before each confirmed step", async () => {
    const { input, readDelegation } = fixture();
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "released",
      checkId: 17,
    });
    expect(execute.mock.calls.map(([request]) => request.operation)).toEqual([
      "queue-check",
      "arm-squash",
      "release-check",
    ]);
    expect(readDelegation).toHaveBeenCalledTimes(4);
  });

  it("stops before releasing a check when either permission is revoked", async () => {
    for (const capability of ["gatePublication", "nativeSquash"] as const) {
      execute.mockClear();
      const { input, readDelegation } = fixture();
      readDelegation
        .mockResolvedValueOnce(delegation)
        .mockResolvedValueOnce(delegation)
        .mockResolvedValueOnce(delegation)
        .mockResolvedValue({ ...delegation, [capability]: false });
      expect(await runStandingWorkIntegration(input)).toEqual({
        status: "denied",
      });
      expect(execute.mock.calls.map(([request]) => request.operation)).toEqual([
        "queue-check",
        "arm-squash",
        "release-check",
      ]);
    }
  });

  it("resumes a confirmed arm from the durable journal without repeating effects", async () => {
    const { input } = fixture();
    vi.mocked(readReservedGitHubWorkIntegration).mockResolvedValue({
      revision: 5,
      reservation: { candidate, state: { phase: "armed", checkId: 17 } },
    });
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "released",
      checkId: 17,
    });
    expect(execute.mock.calls.map(([request]) => request.operation)).toEqual([
      "release-check",
    ]);
  });

  it("observes the previously released candidate before admitting a different one", async () => {
    const { input } = fixture();
    const previous = {
      ...candidate,
      workNumber: 11,
      pullNumber: 21,
      baseSha: "c".repeat(40),
    };
    vi.mocked(readReservedGitHubWorkIntegration).mockResolvedValue({
      revision: 8,
      reservation: {
        candidate: previous,
        state: { phase: "released", checkId: 18 },
      },
    });
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "deferred",
      operation: "queue-check",
    });
    expect(execute).not.toHaveBeenCalled();
    expect(recordReleasedNativeSquash).toHaveBeenCalledWith(
      expect.objectContaining({ candidate: previous }),
    );

    const mergedSha = "d".repeat(40);
    vi.mocked(recordReleasedNativeSquash).mockResolvedValueOnce(mergedSha);
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "released",
      checkId: 17,
    });
    expect(execute.mock.calls.map(([request]) => request.operation)).toEqual([
      "queue-check",
      "arm-squash",
      "release-check",
    ]);
  });

  it("returns the observed squash without replaying the released candidate", async () => {
    const { input } = fixture();
    vi.mocked(readReservedGitHubWorkIntegration).mockResolvedValue({
      revision: 8,
      reservation: { candidate, state: { phase: "released", checkId: 17 } },
    });
    const sha = "d".repeat(40);
    vi.mocked(recordReleasedNativeSquash).mockResolvedValueOnce(sha);
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "merged",
      sha,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("records the reserved squash under separate authority after revocation", async () => {
    const { input, readDelegation, authorizeRecovery } = fixture();
    readDelegation.mockResolvedValue({ ...delegation, nativeSquash: false });
    vi.mocked(readReservedGitHubWorkIntegration).mockResolvedValue({
      revision: 8,
      reservation: { candidate, state: { phase: "released", checkId: 17 } },
    });
    const sha = "d".repeat(40);
    vi.mocked(recordReleasedNativeSquash).mockImplementation(
      async ({ authorize }) => {
        expect(await authorize({ candidate, operation: "release-check" })).toBe(
          false,
        );
        expect(
          await authorize({
            candidate: { ...candidate, pullNumber: 999 },
            operation: "resolve",
          }),
        ).toBe(false);
        return (await authorize({ candidate, operation: "resolve" }))
          ? sha
          : null;
      },
    );

    authorizeRecovery.mockResolvedValueOnce(false);
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "released",
      checkId: 17,
    });
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "merged",
      sha,
    });
    expect(authorizeRecovery.mock.calls).toEqual([[candidate], [candidate]]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("records a confirmed arm after revocation without releasing its check", async () => {
    const { input, readDelegation, authorizeRecovery } = fixture();
    readDelegation.mockResolvedValue({ ...delegation, gatePublication: false });
    vi.mocked(readReservedGitHubWorkIntegration).mockResolvedValue({
      revision: 5,
      reservation: {
        candidate,
        state: { phase: "pending", operation: "arm-squash", checkId: 17 },
      },
    });
    vi.mocked(reconcileReservedGitHubWorkIntegration).mockImplementation(
      async ({ authorize }) => {
        expect(await authorize({ candidate, operation: "resolve" })).toBe(true);
        return {
          status: "confirmed",
          receipt: {
            revision: 6,
            reservation: { candidate, state: { phase: "armed", checkId: 17 } },
          },
        };
      },
    );
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "denied",
    });
    expect(authorizeRecovery).toHaveBeenCalledExactlyOnceWith(candidate);
    expect(execute).not.toHaveBeenCalled();
  });

  it("reconciles a lost arm acknowledgement before resuming release", async () => {
    const { input } = fixture();
    const reservation = {
      candidate,
      state: { phase: "pending", operation: "arm-squash", checkId: 17 },
    } as const;
    vi.mocked(readReservedGitHubWorkIntegration).mockResolvedValue({
      revision: 5,
      reservation,
    });
    vi.mocked(reconcileReservedGitHubWorkIntegration).mockImplementation(
      async ({ authorize }) => {
        expect(await authorize({ candidate, operation: "resolve" })).toBe(true);
        expect(await authorize({ candidate, operation: "arm-squash" })).toBe(
          false,
        );
        return {
          status: "confirmed",
          receipt: {
            revision: 6,
            reservation: { candidate, state: { phase: "armed", checkId: 17 } },
          },
        };
      },
    );
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "released",
      checkId: 17,
    });
    expect(execute.mock.calls.map(([request]) => request.operation)).toEqual([
      "release-check",
    ]);
  });

  it("leaves an unresolved provider effect in the journal without retrying it", async () => {
    const { input } = fixture();
    vi.mocked(readReservedGitHubWorkIntegration).mockResolvedValue({
      revision: 5,
      reservation: {
        candidate,
        state: { phase: "pending", operation: "release-check", checkId: 17 },
      },
    });
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "deferred",
      operation: "release-check",
    });
    expect(reconcileReservedGitHubWorkIntegration).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });

  it("stops on an uncertain journal outcome before attempting another effect", async () => {
    const { input } = fixture();
    execute.mockResolvedValueOnce({ status: "deferred" });
    expect(await runStandingWorkIntegration(input)).toEqual({
      status: "deferred",
      operation: "queue-check",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
