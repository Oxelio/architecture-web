import { mkdtemp, readdir, readFile, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it, vi } from "vitest";

import { produceProtectedSonarSubmission } from "./protected-sonar-producer.js";
import { createProtectedSonarScanner } from "./protected-sonar-scanner.js";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: execute }));

const candidate = {
  repositoryId: 1336937640,
  workNumber: 140,
  pullNumber: 147,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
  sourceBranch: "codex/work-140",
};
const projectKey = "Oxelio_architecture-web";
const report = [
  `projectKey=${projectKey}`,
  "serverUrl=https://sonarcloud.io",
  "ceTaskId=fixture-task",
  "ceTaskUrl=https://sonarcloud.io/api/ce/task?id=fixture-task",
].join("\n");
const now = Date.parse("2026-11-18T11:15:00Z");

function fixture() {
  return {
    enabled: true,
    candidate,
    producerRunId: 202,
    controlSha: "c".repeat(40),
    expiresAt: "2026-11-18T11:30:00Z",
    scannerDistributionDigest: "d".repeat(64),
    sourceContextDigest: "e".repeat(64),
    now: () => now,
    readCandidate: vi.fn(async () => candidate),
    admitSubmission: vi.fn<() => Promise<number | null>>(
      async () => now + 60_000,
    ),
    verifyBoundary: vi.fn(async () => true),
    scan: vi.fn(async () => report),
  };
}

it("uses its own scan settings and binds a successful provider task to the exact candidate", async () => {
  const f = fixture();
  expect(await produceProtectedSonarSubmission(f)).toMatchObject({
    ...candidate,
    producerRunId: 202,
    producerRunAttempt: 1,
    taskId: "fixture-task",
    scannerConfigDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
  });
  expect(f.scan).toHaveBeenCalledTimes(1);
  expect(f.admitSubmission).toHaveBeenCalledWith(
    expect.stringMatching(/^[a-f0-9]{64}$/u),
  );
  expect(f.scan).toHaveBeenCalledWith(
    expect.objectContaining({
      "sonar.projectKey": projectKey,
      "sonar.scm.revision": candidate.headSha,
      "sonar.pullrequest.key": "147",
      "sonar.pullrequest.base": "main",
      "sonar.javascript.lcov.reportPaths": "coverage/lcov.info",
    }),
  );
});

it("prevents submission when inactive, expired or bound to an old base", async () => {
  const f = fixture();
  for (const substitution of [
    { enabled: false },
    { expiresAt: new Date(now).toISOString() },
    { candidate: { ...candidate, baseSha: "f".repeat(40) } },
    {
      candidate: {
        ...candidate,
        sourceBranch: "branch\nsonar.host.url=invalid",
      },
    },
  ]) {
    expect(
      await produceProtectedSonarSubmission({ ...f, ...substitution }),
    ).toBeNull();
  }
  expect(f.scan).not.toHaveBeenCalled();
  f.admitSubmission.mockResolvedValueOnce(null);
  expect(await produceProtectedSonarSubmission(f)).toBeNull();
  expect(f.scan).not.toHaveBeenCalled();
});

it("withholds a producer receipt on malformed reports, uncertainty or revoked authority", async () => {
  const f = fixture();
  for (const badReport of [
    "x".repeat(8193),
    `${report}\ninvalid`,
    `${report}\nceTaskId=duplicate`,
    report.replace(projectKey, "other-project"),
    report.replace(
      "serverUrl=https://sonarcloud.io",
      "serverUrl=https://invalid.example",
    ),
    report.replace("/api/ce/task", "/api/other"),
  ]) {
    f.scan.mockResolvedValueOnce(badReport);
    expect(await produceProtectedSonarSubmission(f)).toBeNull();
  }
  f.scan.mockRejectedValueOnce(new Error("fixture response lost"));
  expect(await produceProtectedSonarSubmission(f)).toBeNull();
  f.verifyBoundary
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);
  expect(await produceProtectedSonarSubmission(f)).toBeNull();
});

it("runs only the configured scanner and reads a bounded receipt outside the checkout", async () => {
  const root = await mkdtemp(join(tmpdir(), "protected-sonar-test-"));
  const filename = join(root, "fixture-scanner");
  const options = {
    executable: filename,
    candidateDirectory: root,
    privateTemporaryRoot: root,
    analysisToken: "fixture-analysis",
  };
  try {
    const scan = createProtectedSonarScanner(options);
    let scannerReport = report;
    execute.mockImplementation(
      (
        _file: string,
        args: string[],
        _options: unknown,
        done: (error: Error | null, stdout?: string, stderr?: string) => void,
      ) => {
        const metadata = args
          .find((value) =>
            value.startsWith("-Dsonar.scanner.metadataFilePath="),
          )
          ?.split("=")[1];
        const settings = args
          .find((value) => value.startsWith("-Dproject.settings="))
          ?.split("=")[1];
        if (!metadata || !settings) {
          done(new Error("Missing private file"));
          return;
        }
        void readFile(settings, "utf8")
          .then(async (contents) => {
            expect(contents).toBe(`sonar.projectKey=${projectKey}`);
            expect(metadata).toContain(root);
            await writeFile(metadata, scannerReport);
            done(null, "", "");
          })
          .catch((error: unknown) =>
            done(error instanceof Error ? error : new Error("Fixture failed")),
          );
      },
    );
    expect(await scan({ "sonar.projectKey": projectKey })).toBe(report);
    expect(execute).toHaveBeenCalledWith(
      filename,
      expect.any(Array),
      expect.objectContaining({
        cwd: root,
        env: expect.objectContaining({ SONAR_TOKEN: "fixture-analysis" }),
      }),
      expect.any(Function),
    );
    scannerReport = "x".repeat(8193);
    await expect(scan({ "sonar.projectKey": projectKey })).rejects.toThrow(
      "SONAR_SCANNER_OUTCOME_UNVERIFIED",
    );
    await expect(
      scan({ "sonar.projectKey": "value\nsonar.host.url=invalid" }),
    ).rejects.toThrow("SONAR_SCANNER_OUTCOME_UNVERIFIED");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(await readdir(root)).toEqual([]);
    expect(() =>
      createProtectedSonarScanner({
        ...options,
        executable: "candidate-scanner",
      }),
    ).toThrow("SONAR_SCANNER_CONFIGURATION_INVALID");
  } finally {
    await rmdir(root);
  }
});
