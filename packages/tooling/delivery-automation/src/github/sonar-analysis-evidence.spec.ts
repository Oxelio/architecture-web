import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ProtectedSonarSubmission,
  readSonarAnalysisEvidence,
  type SonarCandidate,
  sonarGateConditionsDigest,
} from "./sonar-analysis-evidence.js";

const submission: ProtectedSonarSubmission = {
  repositoryId: 1336937640,
  projectKey: "Oxelio_architecture-web",
  pullNumber: 146,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
  sourceBranch: "codex/work-140",
  taskId: "ce-task-1",
  producerRunId: 42,
  controlSha: "c".repeat(40),
  scannerConfigDigest: "d".repeat(64),
  conditionsDigest: sonarGateConditionsDigest,
  startedAt: "2026-11-17T10:00:00Z",
  expiresAt: "2026-11-17T11:00:00Z",
};
const candidate: SonarCandidate = submission;
const tuples = [
  ["new_coverage", "LT", "80"],
  ["new_duplicated_lines_density", "GT", "3"],
  ["new_maintainability_rating", "GT", "1"],
  ["new_reliability_rating", "GT", "1"],
  ["new_security_hotspots_reviewed", "LT", "100"],
  ["new_security_rating", "GT", "1"],
];

function fixture() {
  return {
    task: {
      id: submission.taskId,
      componentKey: submission.projectKey,
      type: "REPORT",
      status: "SUCCESS",
      analysisId: "analysis-1",
      submittedAt: "2026-11-17T10:01:00Z",
      executedAt: "2026-11-17T10:02:00Z",
    },
    pull: {
      key: "146",
      branch: submission.sourceBranch,
      base: "main",
      target: "main",
      commit: { sha: submission.headSha },
      status: { qualityGateStatus: "OK" },
      analysisDate: "2026-11-17T10:01:30Z",
    },
    definition: {
      id: 9,
      name: "Sonar way",
      conditions: tuples.map(([metric, op, error]) => ({ metric, op, error })),
    },
    result: {
      status: "OK",
      ignoredConditions: false,
      conditions: tuples.map(([metricKey, comparator, errorThreshold]) => ({
        metricKey,
        comparator,
        errorThreshold,
        status: "OK",
      })),
    },
  };
}

function setup(edit?: (value: ReturnType<typeof fixture>) => void) {
  const value = fixture();
  edit?.(value);
  const fetchImpl = vi.fn<typeof fetch>(async (url) => {
    const endpoint = new URL(String(url));
    switch (endpoint.pathname) {
      case "/api/authentication/validate":
        return Response.json({ valid: true });
      case "/api/ce/task":
        return Response.json({ task: value.task });
      case "/api/project_pull_requests/list":
        return Response.json({ pullRequests: [value.pull] });
      case "/api/qualitygates/get_by_project":
        return Response.json({ qualityGate: { id: 9 } });
      case "/api/qualitygates/show":
        return Response.json(value.definition);
      case "/api/qualitygates/project_status":
        expect(endpoint.searchParams.get("analysisId")).toBe("analysis-1");
        return Response.json({ projectStatus: value.result });
      default:
        throw new Error("Unrecognized fixture endpoint");
    }
  });
  return {
    value,
    input: {
      enabled: true,
      token: "fixture-reader",
      readTrustedSubmission: vi.fn(
        async (): Promise<ProtectedSonarSubmission | null> => ({
          ...submission,
        }),
      ),
      readCandidate: vi.fn(async (): Promise<SonarCandidate | null> => ({
        ...candidate,
      })),
      fetchImpl,
      now: () => Date.parse("2026-11-17T10:05:00Z"),
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("preparation-only authenticated Sonar reader", () => {
  it("is disabled without an explicit caller and never publishes a check", async () => {
    const { input } = setup();
    await expect(
      readSonarAnalysisEvidence({ ...input, enabled: false }),
    ).resolves.toEqual({ status: "inactive" });
    expect(input.readTrustedSubmission).not.toHaveBeenCalled();
    expect(input.fetchImpl).not.toHaveBeenCalled();
  });

  it("binds the protected scan receipt, provider task, exact candidate and existing criteria", async () => {
    const { input } = setup();
    const result = await readSonarAnalysisEvidence(input);
    expect(result).toEqual({
      status: "verified",
      submission,
      analysisId: "analysis-1",
      factsDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    for (const [url, options] of input.fetchImpl.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/sonarcloud\.io\/api\//u);
      expect(new Headers(options?.headers).get("authorization")).toBe(
        "Bearer fixture-reader",
      );
      expect(options?.redirect).toBe("error");
      expect(options?.method).toBeUndefined();
      expect(options?.body).toBeUndefined();
    }
    expect(input.readTrustedSubmission).toHaveBeenCalledTimes(2);
    expect(input.readCandidate).toHaveBeenCalledTimes(2);
  });

  it.each([
    { repositoryId: 1 },
    { projectKey: "another-project" },
    { taskId: "https://attacker.invalid/task" },
    { conditionsDigest: "0".repeat(64) },
    { headSha: "0".repeat(40) },
    { baseSha: "0".repeat(40) },
    { controlSha: "invalid" },
    { startedAt: "2026-11-17T10:06:00Z" },
    { expiresAt: "2026-11-17T10:00:00Z" },
  ])(
    "rejects mismatched, stale or invalid trusted submission data",
    async (change) => {
      const { input } = setup();
      input.readTrustedSubmission.mockResolvedValue({
        ...submission,
        ...change,
      });
      await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
        status: "deferred",
      });
      expect(input.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("cannot replace the producer record with a green GitHub result or a missing token", async () => {
    const { input } = setup();
    input.readTrustedSubmission.mockResolvedValue(null);
    await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
      status: "deferred",
    });
    expect(input.fetchImpl).not.toHaveBeenCalled();
    const second = setup();
    await expect(
      readSonarAnalysisEvidence({ ...second.input, token: "" }),
    ).resolves.toEqual({ status: "deferred" });
    expect(second.input.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    () => Response.json({ valid: false }),
    () => Response.json({ valid: true }, { status: 401 }),
    () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://attacker.invalid" },
      }),
    () => Response.json({ valid: true }, { status: 503 }),
  ])(
    "rejects unauthenticated, redirected and unavailable provider responses",
    async (response) => {
      const { input } = setup();
      input.fetchImpl.mockResolvedValueOnce(response());
      await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
        status: "deferred",
      });
      expect(input.fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["PENDING", "IN_PROGRESS", "FAILED", "CANCELED"])(
    "defers CE task status %s",
    async (status) => {
      const { input } = setup((value) => {
        value.task.status = status;
      });
      await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
        status: "deferred",
      });
      expect(input.fetchImpl).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    (v: ReturnType<typeof fixture>) => {
      v.task.id = "wrong-task";
    },
    (v: ReturnType<typeof fixture>) => {
      v.task.componentKey = "wrong-project";
    },
    (v: ReturnType<typeof fixture>) => {
      v.task.analysisId = "";
    },
    (v: ReturnType<typeof fixture>) => {
      v.task.submittedAt = "2026-11-16T10:00:00Z";
    },
    (v: ReturnType<typeof fixture>) => {
      v.pull.commit.sha = "0".repeat(40);
    },
    (v: ReturnType<typeof fixture>) => {
      v.pull.base = "other";
    },
    (v: ReturnType<typeof fixture>) => {
      v.pull.branch = "other";
    },
    (v: ReturnType<typeof fixture>) => {
      v.pull.analysisDate = "2026-11-16T10:00:00Z";
    },
    (v: ReturnType<typeof fixture>) => {
      v.result.status = "ERROR";
    },
    (v: ReturnType<typeof fixture>) => {
      v.result.ignoredConditions = true;
    },
    (v: ReturnType<typeof fixture>) => {
      v.result.conditions.pop();
    },
    (v: ReturnType<typeof fixture>) => {
      v.definition.conditions = v.definition.conditions.map((item) => ({
        ...item,
        error: "20",
      }));
    },
    (v: ReturnType<typeof fixture>) => {
      v.result.conditions = v.result.conditions.map((item) => ({
        ...item,
        errorThreshold: "20",
      }));
    },
    (v: ReturnType<typeof fixture>) => {
      v.result.conditions = v.result.conditions.map((item) => ({
        ...item,
        status: "ERROR",
      }));
    },
  ])(
    "defers mismatched tasks, PR context, weakened or incomplete gate evidence",
    async (edit) => {
      const { input } = setup(edit);
      await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
        status: "deferred",
      });
    },
  );

  it("rejects ambiguous pull request inventory", async () => {
    const { value, input } = setup();
    input.fetchImpl
      .mockResolvedValueOnce(Response.json({ valid: true }))
      .mockResolvedValueOnce(Response.json({ task: value.task }))
      .mockResolvedValueOnce(
        Response.json({ pullRequests: [value.pull, value.pull] }),
      );
    await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
      status: "deferred",
    });
  });

  it("rechecks producer authorization and candidate head/base after reading Sonar", async () => {
    for (const mode of ["revocation", "head", "base"] as const) {
      const { input } = setup();
      if (mode === "revocation") {
        input.readTrustedSubmission
          .mockResolvedValueOnce(submission)
          .mockResolvedValueOnce(null);
      } else {
        input.readCandidate
          .mockResolvedValueOnce(candidate)
          .mockResolvedValueOnce({
            ...candidate,
            [mode === "head" ? "headSha" : "baseSha"]: "0".repeat(40),
          });
      }
      await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
        status: "deferred",
      });
    }
  });

  it("detects task, PR or gate replacement during collection", async () => {
    for (const mode of ["task", "pull", "gate"] as const) {
      const { input } = setup();
      const original = input.fetchImpl.getMockImplementation();
      if (!original) {
        throw new Error("Fixture transport is missing");
      }
      let count = 0;
      input.fetchImpl.mockImplementation(async (...args) => {
        count += 1;
        if (count === 7 && mode === "task") {
          const task = fixture().task;
          return Response.json({
            task: { ...task, analysisId: "replacement" },
          });
        }
        if (count === 8 && mode === "pull") {
          return Response.json({
            pullRequests: [
              { ...fixture().pull, analysisDate: "2026-11-17T10:01:40Z" },
            ],
          });
        }
        if (count === 10 && mode === "gate") {
          return Response.json({
            ...fixture().definition,
            name: "Changed definition",
          });
        }
        return original(...args);
      });
      await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
        status: "deferred",
      });
    }
  });

  it.each([() => Response.json(null), () => Response.json({ task: [] })])(
    "defers malformed provider data without treating it as an authenticated proof",
    async (response) => {
      const { input } = setup();
      input.fetchImpl
        .mockResolvedValueOnce(Response.json({ valid: true }))
        .mockResolvedValueOnce(response());
      await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
        status: "deferred",
      });
    },
  );

  it("rejects absent PR inventory rather than inferring the current candidate", async () => {
    const { input } = setup();
    input.fetchImpl
      .mockResolvedValueOnce(Response.json({ valid: true }))
      .mockResolvedValueOnce(Response.json({ task: fixture().task }))
      .mockResolvedValueOnce(Response.json({}));
    await expect(readSonarAnalysisEvidence(input)).resolves.toEqual({
      status: "deferred",
    });
  });

  it("detects receipt expiry during provider reads", async () => {
    const { input } = setup();
    const times = vi
      .fn()
      .mockReturnValueOnce(Date.parse("2026-11-17T10:05:00Z"))
      .mockReturnValueOnce(Date.parse("2026-11-17T10:05:00Z"))
      .mockReturnValueOnce(Date.parse("2026-11-17T10:05:00Z"))
      .mockReturnValue(Date.parse(submission.expiresAt));
    await expect(
      readSonarAnalysisEvidence({ ...input, now: times }),
    ).resolves.toEqual({ status: "deferred" });
  });

  it("contains unknown HTTP/JSON failures and never exposes credentials in an outcome", async () => {
    const { input } = setup();
    input.fetchImpl.mockRejectedValueOnce(
      new Error("fixture-reader diagnostic"),
    );
    const result = await readSonarAnalysisEvidence(input);
    expect(result).toEqual({ status: "deferred" });
    expect(JSON.stringify(result)).not.toContain(input.token);
  });
});
