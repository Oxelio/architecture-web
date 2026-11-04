import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Step {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, string | boolean | number>;
  env?: Record<string, string>;
  "continue-on-error"?: boolean;
}
interface Job {
  environment?: string;
  uses?: string;
  needs?: string | string[];
  if?: string;
  secrets?: unknown;
  permissions?: Record<string, string>;
  with?: Record<string, string>;
  "continue-on-error"?: boolean;
  steps?: Step[];
}
interface Workflow {
  concurrency: { group: string; "cancel-in-progress": string };
  on: Record<
    string,
    { branches?: string[]; types?: string[]; secrets?: unknown }
  >;
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
}

function workflow(name: string): Workflow {
  return parse(
    readFileSync(
      new URL(`../../../../../.github/workflows/${name}.yml`, import.meta.url),
      "utf8",
    ),
  ) as Workflow;
}

describe("CI trust and failure boundaries", () => {
  const ci = workflow("delivery-automation-validation");
  const shared = workflow("repository-validation");
  const release = workflow("release");

  it("wires integration observation to a fresh protected dispatch with read-only permissions", () => {
    const observation = workflow("delivery-work-integration-observation");
    expect(Object.keys(observation.on)).toEqual(["workflow_dispatch"]);
    expect(Object.values(observation.permissions)).toEqual([
      "read",
      "read",
      "read",
      "read",
    ]);
    const job = observation.jobs["observe"];
    expect(job?.if).toBe(
      "github.ref == 'refs/heads/main' && github.run_attempt == 1 && github.actor == github.repository_owner",
    );
    expect(job?.environment).toBe("delivery-integration-observation");
    expect(job?.permissions).toBeUndefined();
    expect(job?.steps?.[0]?.with).toMatchObject({
      ref: "${{ github.workflow_sha }}",
      "persist-credentials": false,
    });
    const evaluator = job?.steps?.find((step) =>
      step.run?.includes("work-merge-observe.ts"),
    );
    expect(evaluator?.env?.["DELIVERY_OBSERVATION_GRANT"]).toBe(
      "${{ vars.DELIVERY_OBSERVATION_GRANT }}",
    );
    expect(JSON.stringify(observation)).not.toMatch(
      /contents: write|issues: write|pull-requests: write|checks: write/,
    );
  });

  it("imports the validated type context without installing or building in the credential-bearing job", () => {
    const primary = shared.jobs["validate"]?.steps ?? [];
    const exported = primary.find(
      (step) => step.with?.["name"] === "sonar-type-context",
    );
    expect(exported?.with?.["path"]).toBe(
      "${{ runner.temp }}/sonar-type-context.tar.gz",
    );
    const packageContext = primary.find((step) =>
      step.run?.includes("find node_modules apps packages"),
    );
    expect(packageContext?.run).toContain("-prune -print0");
    expect(packageContext?.run).toContain("--null --files-from=-");
    const analysis = ci.jobs["sonar"]?.steps ?? [];
    const imported = analysis.findIndex(
      (step) => step.with?.["name"] === "sonar-type-context",
    );
    const restored = analysis.findIndex((step) =>
      step.run?.startsWith("tar --extract"),
    );
    const scanned = analysis.findIndex((step) =>
      step.uses?.startsWith("SonarSource/sonarqube-scan-action@"),
    );
    expect(imported).toBeGreaterThanOrEqual(0);
    expect(restored).toBeGreaterThan(imported);
    expect(scanned).toBeGreaterThan(restored);
    for (const step of analysis.slice(imported, scanned)) {
      expect(step.env?.["SONAR_TOKEN"]).toBeUndefined();
      expect(step.run ?? "").not.toMatch(/pnpm (?:install|build)/u);
    }
  });

  it("validates draft, edited and integrated candidates through the same read-only workflow", () => {
    expect(ci.on["pull_request"]?.branches).toEqual(["main"]);
    expect(ci.on["pull_request"]?.types).toContain("edited");
    expect(ci.on["push"]?.branches).toEqual(["main"]);
    for (const definition of [ci, shared]) {
      expect(definition.on).not.toHaveProperty("pull_request_target");
      expect(definition.on).not.toHaveProperty("workflow_run");
      expect(definition.permissions).toEqual({ contents: "read" });
      for (const [name, job] of Object.entries(definition.jobs)) {
        expect(job.permissions ?? definition.permissions).toEqual({
          contents: "read",
          ...(definition === ci && name === "quality"
            ? { actions: "read", checks: "read", "pull-requests": "read" }
            : {}),
        });
      }
    }
    for (const caller of [ci.jobs["validate"], release.jobs["validate"]]) {
      expect(caller?.uses).toBe(
        "./.github/workflows/repository-validation.yml",
      );
      expect(caller?.secrets).toBeUndefined();
    }
    expect(shared.on["workflow_call"]?.secrets).toBeUndefined();
    expect(JSON.stringify(shared)).not.toContain("secrets.");
    for (const job of Object.values(shared.jobs)) {
      expect(
        job.steps?.find((step) => step.uses?.startsWith("actions/checkout@"))
          ?.with?.["ref"],
      ).toBe("${{ inputs.candidate_sha }}");
    }
    expect(release.jobs["validate"]?.with?.["candidate_sha"]).toBe(
      "${{ needs.plan.outputs.source_sha }}",
    );
  });

  it("excludes Sonar from mandatory acceptance and release publication", () => {
    expect(ci.jobs["sonar"]?.["continue-on-error"]).toBe(true);
    for (const definition of [ci, shared, release]) {
      for (const [name, job] of Object.entries(definition.jobs)) {
        if (name !== "sonar") {
          expect(job["continue-on-error"]).not.toBe(true);
          expect(job.steps?.some((step) => step["continue-on-error"])).not.toBe(
            true,
          );
          expect([job.needs].flat()).not.toContain("sonar");
        }
      }
    }
    expect(ci.jobs["quality"]?.needs).toEqual([
      "route",
      "validate",
      "dependency-review",
    ]);
    expect(ci.jobs["quality"]?.if).toBe("always()");
    expect(release.jobs["generate"]?.needs).toEqual(["plan", "validate"]);
    expect(release.jobs["publish"]?.needs).toEqual([
      "plan",
      "validate",
      "generate",
    ]);
    expect(ci.jobs["sonar"]?.steps?.at(-1)?.if).toBe("always()");
  });

  it("never enters the credential-bearing Sonar job for a fork, Dependabot or a non-main dispatch", () => {
    for (const [event, ref, repo, author, allowed] of [
      [
        "pull_request",
        "refs/pull/63/merge",
        "Oxelio/architecture-web",
        "Oxelio",
        true,
      ],
      [
        "pull_request",
        "refs/pull/63/merge",
        "contributor/fork",
        "contributor",
        false,
      ],
      [
        "pull_request",
        "refs/pull/63/merge",
        "Oxelio/architecture-web",
        "dependabot[bot]",
        false,
      ],
      ["push", "refs/heads/main", "Oxelio/architecture-web", "Oxelio", true],
      [
        "workflow_dispatch",
        "refs/heads/temporary",
        "Oxelio/architecture-web",
        "Oxelio",
        false,
      ],
    ]) {
      const github = {
        event_name: event,
        ref,
        repository: "Oxelio/architecture-web",
        event: {
          pull_request: {
            head: { repo: { full_name: repo } },
            user: { login: author },
          },
        },
      };
      expect(
        runInNewContext(
          ci.jobs["sonar"]?.if ?? "false",
          { github, needs: { route: { outputs: { mode: "full" } } } },
          { timeout: 100 },
        ),
      ).toBe(allowed);
    }
    expect(
      ci.jobs["sonar"]?.steps?.some((step) =>
        step.run?.includes("pnpm install"),
      ),
    ).toBe(false);
    for (const [name, job] of Object.entries(ci.jobs)) {
      if (name !== "sonar") {
        expect(JSON.stringify(job)).not.toContain("secrets.");
      }
    }
  });

  it("collects native Node coverage before merging and exporting the single artifact", () => {
    const steps = shared.jobs["validate"]?.steps ?? [];
    const collect = steps.findIndex(
      (step) => step.run === "pnpm ci:test:tooling",
    );
    const merge = steps.findIndex(
      (step) => step.run === "node scripts/merge-coverage.mjs",
    );
    const upload = steps.findIndex(
      (step) => step.with?.["name"] === "sonar-coverage",
    );
    expect(collect).toBeGreaterThan(
      steps.findIndex((step) => step.run === "pnpm ci:test:integration"),
    );
    expect(merge).toBeGreaterThan(collect);
    expect(upload).toBeGreaterThan(merge);
    expect(
      shared.jobs["node-compatibility"]?.steps?.some(
        (step) => step.run === "pnpm ci:test:tooling",
      ),
    ).toBe(true);
    const root = JSON.parse(
      readFileSync(
        new URL("../../../../../package.json", import.meta.url),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };
    const command = root.scripts["ci:test:tooling"];
    expect(command).toContain("--experimental-test-coverage");
    expect(command).toContain("--test-reporter=lcov");
    expect(command).toContain(
      "--test-reporter-destination=coverage/scripts/lcov.info",
    );
    expect(command).toContain("scripts/run-workspace-tests.test.mjs");
    expect(command).toContain("scripts/merge-coverage.test.mjs");
    expect(command).toContain("scripts/quality-gate.test.mjs");
  });

  it("runs metadata routing without expensive validation and isolates cancellation groups", () => {
    expect(
      ci.jobs["route"]?.steps?.find((step) => step.id === "route")?.run,
    ).toBe("node scripts/quality-gate.mjs route");
    expect(ci.jobs["route"]?.steps?.at(-1)?.name).toBe(
      "Selected validation route (${{ steps.route.outputs.mode }})",
    );
    expect(ci.jobs["route"]?.steps?.at(-1)?.run).toBe(":");
    expect(ci.jobs["validate"]?.if).toBe("needs.route.outputs.mode == 'full'");
    expect(ci.jobs["dependency-review"]?.if).toContain(
      "needs.route.outputs.mode == 'full'",
    );
    expect(ci.jobs["sonar"]?.if).toContain(
      "needs.route.outputs.mode == 'full'",
    );
    expect(ci.concurrency.group).toContain(
      "github.event.action == 'edited' && github.run_id",
    );
    expect(ci.jobs).not.toHaveProperty("commitlint");
    const quality = ci.jobs["quality"]?.steps ?? [];
    expect(
      quality.some(
        (step) =>
          step.run === "pnpm install --frozen-lockfile --ignore-scripts",
      ),
    ).toBe(true);
    const gate = quality.at(-1);
    expect(gate?.run).toBe("node scripts/quality-gate.mjs");
    expect(gate?.env?.["GITHUB_TOKEN"]).toBe("${{ github.token }}");
    expect(gate?.env?.["VALIDATION_MODE"]).toBe(
      "${{ needs.route.outputs.mode }}",
    );
    expect(JSON.stringify(quality)).not.toContain(
      "github.event.pull_request.title",
    );
  });

  it("records actual PR inputs before candidate installation in both supported runtimes", () => {
    for (const [name, role] of [
      ["validate", "primary"],
      ["node-compatibility", "node24"],
    ] as const) {
      const steps = shared.jobs[name]?.steps ?? [];
      const identity = steps.findIndex(
        (step) => step.run === "node scripts/quality-gate.mjs identity",
      );
      const upload = steps.findIndex(
        (step) =>
          step.with?.["name"] ===
          `pr-validation-identity-\${{ github.run_attempt }}-${role}`,
      );
      const install = steps.findIndex(
        (step) => step.run === "pnpm install --frozen-lockfile",
      );
      expect(identity).toBeGreaterThanOrEqual(0);
      expect(upload).toBeGreaterThan(identity);
      expect(install).toBeGreaterThan(upload);
      expect(steps[identity]?.if).toBe("github.event_name == 'pull_request'");
      expect(steps[identity]?.env?.["CANDIDATE_SHA"]).toBe(
        "${{ inputs.candidate_sha }}",
      );
      expect(steps[identity]?.env?.["COMPARISON_BASE"]).toBe(
        "${{ inputs.comparison_base }}",
      );
      expect(steps[upload]?.if).toBe("github.event_name == 'pull_request'");
      expect(steps[upload]?.with?.["retention-days"]).toBe(7);
      expect(steps[upload]?.with?.["if-no-files-found"]).toBe("error");
      expect(steps.some((step) => step.run === "pnpm ci:test:tooling")).toBe(
        true,
      );
    }
  });

  it("keeps source execution and publication credentials separate", () => {
    const steps = shared.jobs["validate"]?.steps ?? [];
    expect(steps.some((step) => step.run === "pnpm ci:test:integration")).toBe(
      true,
    );
    expect(
      steps.some((step) => step.run?.startsWith("git diff --check ")),
    ).toBe(true);
    expect(release.jobs["publish"]?.permissions).toEqual({
      contents: "write",
      actions: "read",
    });
    expect(
      release.jobs["publish"]?.steps?.find((step) =>
        step.uses?.startsWith("actions/checkout@"),
      )?.with?.["ref"],
    ).toBe("${{ github.workflow_sha }}");
    expect(
      release.jobs["publish"]?.steps?.some(
        (step) =>
          step.run === "pnpm install --frozen-lockfile --ignore-scripts",
      ),
    ).toBe(true);
    expect(
      release.jobs["generate"]?.steps?.some(
        (step) => step.run === "pnpm build",
      ),
    ).toBe(false);
  });
});
