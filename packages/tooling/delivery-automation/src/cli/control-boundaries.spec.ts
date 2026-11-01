import { afterEach, expect, it, vi } from "vitest";

vi.mock("../config/activation-context.js", () => ({
  resolveActivationContext: () => ({
    status: "available",
    project: { id: "PVT_fixture" },
    activation: { taskClaim: true },
  }),
}));
vi.mock("../github/github-project-inventory.js", () => ({
  readGitHubInventory: () => Promise.resolve({ projects: [] }),
}));
vi.mock("../github/gate-live-evidence.js", () => ({
  readWorkMergeGateLiveEvidence: () =>
    Promise.resolve({
      status: "available",
      target: {
        pullRequestNumber: 2,
        headRef: "candidate",
        headSha: "a".repeat(40),
        baseRef: "main",
      },
      workState: "Validating",
      dependenciesResolved: true,
      pullRequestMergeable: true,
    }),
}));
vi.mock("./gate-publication-support.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./gate-publication-support.js")>()),
  readActivationManifest: () => Promise.resolve({}),
}));

const argv = process.argv;
const exitCode = process.exitCode;
afterEach(() => {
  process.argv = argv;
  process.exitCode = exitCode;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function environment() {
  vi.resetModules();
  vi.stubEnv("GITHUB_REPOSITORY", "example/fixture");
  vi.stubEnv("GITHUB_TOKEN", "test-token");
  vi.stubEnv("ARCHITECTURE_WEB_PROJECTS_TOKEN", "test-token");
}

it.each([
  [[], "--claimant is required"],
  [
    ["--claimant", "operator", "--generation", "supplied"],
    "must not be supplied for acquire",
  ],
  [["--claimant", "operator"], "--execution-kind is required"],
] as const)(
  "rejects invalid acquisition options before any publisher call",
  async (options, message) => {
    environment();
    process.argv = [
      process.execPath,
      "task-claim",
      "acquire",
      "--work",
      "1",
      "--task",
      "2",
      ...options,
    ];
    const stderr = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await import("./task-claim.js");
    expect(process.exitCode).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining(message));
  },
);

it.each([true, false])(
  "serializes a deterministic merge assessment with assertions=%s",
  async (satisfied) => {
    environment();
    vi.stubEnv("WORK_NUMBER", "1");
    for (const name of [
      "REQUIRED_TASKS_ACCEPTABLE",
      "APPLICABLE_REVIEWS_ACCEPTED",
      "VALIDATION_SUFFICIENT",
      "PRIOR_AUTHORITY_GATES_SATISFIED",
      "WORKING_DECISIONS_RESOLVED",
      "REPOSITORY_CHECKS_SATISFIED",
    ]) {
      vi.stubEnv(name, String(satisfied));
    }
    for (const name of [
      "TASKS_EVIDENCE_REF",
      "REVIEWS_EVIDENCE_REF",
      "VALIDATION_EVIDENCE_REF",
      "AUTHORITY_EVIDENCE_REF",
      "WORKING_DECISIONS_EVIDENCE_REF",
      "REPOSITORY_CHECKS_EVIDENCE_REF",
    ]) {
      vi.stubEnv(name, "fixture|evidence");
    }
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await import("./work-merge-gate-evaluate.js");
    const output = JSON.parse(String(stdout.mock.calls[0]?.[0]));
    expect(output.check.headSha).toBe("a".repeat(40));
    expect(output.check.summary).toContain("Work: #1");
    expect(output.check.summary).toContain(String.raw`fixture\|evidence`);
    expect(output.check.summary).toContain(satisfied ? "PASS" : "FAIL");
  },
);
