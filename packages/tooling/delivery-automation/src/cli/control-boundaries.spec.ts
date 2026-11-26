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
vi.mock("./read-activation-manifest.js", () => ({
  readActivationManifest: () =>
    Promise.resolve({ mappings: { taskClaim: { status: "verified" } } }),
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
