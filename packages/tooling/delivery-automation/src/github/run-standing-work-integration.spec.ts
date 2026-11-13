import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeEligibleStandingWorkIntegration } from "./eligible-standing-work-integration.js";
import { readReservedGitHubWorkIntegration } from "./reserved-work-integration.js";
import { runStandingWorkIntegration } from "./run-standing-work-integration.js";

vi.mock("./eligible-standing-work-integration.js");
vi.mock("./reserved-work-integration.js");

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
};
const execute = vi.mocked(executeEligibleStandingWorkIntegration);

function fixture() {
  const readDelegation = vi.fn(async () => delegation);
  const input = {
    standingEnabled: true,
    candidate,
    context,
    readDelegation,
    scope: {
      publisher: { repository, repositoryId, actorId: controllerBotId },
      controllerBotId,
    },
  } as unknown as Parameters<typeof runStandingWorkIntegration>[0];
  return { input, readDelegation };
}

beforeEach(() => {
  vi.mocked(readReservedGitHubWorkIntegration)
    .mockReset()
    .mockResolvedValue(null);
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
      tagSha: "c".repeat(40),
      reservationId: "delivery-control/r1",
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
