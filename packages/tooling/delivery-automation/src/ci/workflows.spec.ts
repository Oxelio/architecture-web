import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Step {
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, string | boolean | number>;
  env?: Record<string, string>;
  "continue-on-error"?: boolean;
}
interface Job {
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

  it("validates draft, edited and integrated candidates through the same read-only workflow", () => {
    expect(ci.on["pull_request"]?.branches).toEqual(["main"]);
    expect(ci.on["pull_request"]?.types).toContain("edited");
    expect(ci.on["push"]?.branches).toEqual(["main"]);
    for (const definition of [ci, shared]) {
      expect(definition.on).not.toHaveProperty("pull_request_target");
      expect(definition.on).not.toHaveProperty("workflow_run");
      expect(definition.permissions).toEqual({ contents: "read" });
      for (const job of Object.values(definition.jobs)) {
        expect(job.permissions ?? definition.permissions).toEqual({
          contents: "read",
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
      "validate",
      "dependency-review",
      "commitlint",
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
          { github },
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
