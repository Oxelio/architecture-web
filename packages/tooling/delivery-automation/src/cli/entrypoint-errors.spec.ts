import { afterEach, describe, expect, it, vi } from "vitest";

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const entrypoints = [
  ["activation verification", () => import("./activation-verify.js")],
  ["claim reconciliation", () => import("./claim-reconcile-plan.js")],
  ["dispatch authorization", () => import("./coordinator-dispatch.js")],
  ["coordinator dry run", () => import("./coordinator-dry-run.js")],
  ["gate publication", () => import("./gate-check-publish.js")],
  ["inventory", () => import("./inventory.js")],
  ["target verification", () => import("./target-verify.js")],
  ["task claim", () => import("./task-claim.js")],
  ["merge evaluation", () => import("./work-merge-gate-evaluate.js")],
] as const;

describe("delivery CLI failure contracts", () => {
  it.each(entrypoints)(
    "%s reports invalid configuration before network effects",
    async (_, load) => {
      vi.resetModules();
      process.argv = [process.execPath, "entrypoint", "--unknown-option"];
      process.exitCode = undefined;
      vi.stubEnv("GITHUB_REPOSITORY", "");
      vi.stubEnv("GITHUB_TOKEN", "");
      vi.stubEnv("ARCHITECTURE_WEB_PROJECTS_TOKEN", "");
      const fetch = vi.fn(() => {
        throw new Error("Network must not be reached");
      });
      vi.stubGlobal("fetch", fetch);
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      await load();
      expect(process.exitCode).toBe(1);
      expect(stderr.mock.calls.length + consoleError.mock.calls.length).toBe(1);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid gate pass value before publishing", async () => {
    vi.resetModules();
    vi.stubEnv("GITHUB_REPOSITORY", "example/fixture");
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv(
      "GATE_RESULT_B64",
      Buffer.from(
        JSON.stringify({
          gate: "work-merge",
          check: {
            name: "Architecture Web / Work Merge Gate (observation)",
            headSha: "a".repeat(40),
            externalId: `work:91:pr:92:${"a".repeat(40)}:${"b".repeat(40)}`,
            title: "Check",
            summary: "Evidence",
            pass: "true",
          },
        }),
      ).toString("base64"),
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await import("./gate-check-publish.js");
    expect(process.exitCode).toBe(1);
    expect(String(stderr.mock.calls[0]?.[0])).toContain("invalid pass result");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses observation reruns before contacting any owner", async () => {
    vi.resetModules();
    vi.stubEnv("GITHUB_EVENT_NAME", "workflow_dispatch");
    vi.stubEnv("GITHUB_REF", "refs/heads/main");
    vi.stubEnv("GITHUB_RUN_ATTEMPT", "2");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await import("./work-merge-observe.js");
    expect(process.exitCode).toBe(1);
    expect(String(stderr.mock.calls[0]?.[0])).toContain("fresh dispatch");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    {
      actor: "other",
      ownerId: 83680141,
      mode: "direct",
      requests: 0,
      outcome: "authenticated Project maintainer",
    },
    {
      actor: "Oxelio",
      ownerId: 99,
      mode: "direct",
      requests: 1,
      outcome: "Project operational owner unavailable",
    },
    {
      actor: "Oxelio",
      ownerId: 83680141,
      mode: "other",
      requests: 0,
      outcome: "MERGE_MODE must be direct or auto",
    },
    {
      actor: "Oxelio",
      ownerId: 83680141,
      mode: "direct",
      requests: 2,
      outcome: "CANDIDATE_CHANGED",
    },
  ])(
    "checks observation actor $actor, owner $ownerId, mode $mode",
    async ({ actor, ownerId, mode, requests, outcome }) => {
      vi.resetModules();
      process.exitCode = undefined;
      const sha = "a".repeat(40);
      const env = {
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_REF: "refs/heads/main",
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_SHA: sha,
        TRUSTED_WORKFLOW_SHA: sha,
        GITHUB_ACTOR: actor,
        GITHUB_ACTOR_ID: "83680141",
        GITHUB_REPOSITORY: "Oxelio/architecture-web",
        GITHUB_REPOSITORY_ID: "1336937640",
        GITHUB_TOKEN: "repo-fixture",
        DELIVERY_OBSERVATION_PROJECTS_TOKEN: "projects-fixture",
        WORK_NUMBER: "91",
        PULL_NUMBER: "92",
        HEAD_SHA: sha,
        BASE_SHA: "b".repeat(40),
        MERGE_MODE: mode,
        DELIVERY_OBSERVATION_GRANT: JSON.stringify({
          actorId: 83680141,
          repositoryId: 1336937640,
          workNumber: 91,
          pullNumber: 92,
          direct: true,
        }),
      };
      for (const [name, value] of Object.entries(env)) {
        vi.stubEnv(name, value);
      }
      const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "https://api.github.com/graphql") {
          expect(new Headers(init?.headers).get("authorization")).toBe(
            "Bearer projects-fixture",
          );
          expect(JSON.parse(String(init?.body)).variables).toEqual({
            owner: "Oxelio",
            number: 3,
          });
          return Response.json({
            data: {
              user: {
                databaseId: ownerId,
                projectV2: { id: "project", number: 3, closed: false },
              },
            },
          });
        }
        expect(url).toBe(
          "https://api.github.com/repos/Oxelio/architecture-web/pulls/92",
        );
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer repo-fixture",
        );
        expect(init?.method).toBe("GET");
        return Response.json({ number: 93 });
      });
      vi.stubGlobal("fetch", fetch);
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      await import("./work-merge-observe.js");
      expect(process.exitCode).toBe(requests === 2 ? 2 : 1);
      expect(
        String((requests === 2 ? stdout : stderr).mock.calls[0]?.[0]),
      ).toContain(outcome);
      expect(fetch).toHaveBeenCalledTimes(requests);
    },
  );
});
