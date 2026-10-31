import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Step {
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  "continue-on-error"?: boolean;
}
interface Job {
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
  "continue-on-error"?: boolean;
  steps: Step[];
}
interface Workflow {
  on: Record<string, { branches?: string[] }>;
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
  const validation = workflow("delivery-automation-validation");
  const release = workflow("release");

  it("validates PR and integrated candidates with read-only credentials", () => {
    expect(validation.on["pull_request"]?.branches).toEqual(["main"]);
    expect(validation.on["push"]?.branches).toEqual(["main"]);
    expect(validation.on).not.toHaveProperty("pull_request_target");
    expect(validation.on).not.toHaveProperty("workflow_run");
    expect(validation.permissions).toEqual({ contents: "read" });
    for (const job of Object.values(validation.jobs)) {
      expect(job.permissions ?? validation.permissions).toEqual({
        contents: "read",
      });
    }
  });

  it("isolates tolerated Sonar failures from blocking checks and publication", () => {
    expect(validation.jobs["sonar"]?.["continue-on-error"]).toBe(true);
    for (const [name, job] of Object.entries(validation.jobs)) {
      if (name !== "sonar") {
        expect(job["continue-on-error"]).not.toBe(true);
        expect(job.steps.every((step) => !step["continue-on-error"])).toBe(
          true,
        );
        expect([job.needs].flat()).not.toContain("sonar");
      }
    }
    for (const job of Object.values(release.jobs)) {
      expect([job.needs].flat()).not.toContain("sonar");
    }
  });

  it("excludes forks and Dependabot before the secret-bearing scan job", () => {
    const sonar = validation.jobs["sonar"];
    expect(sonar?.if).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(sonar?.if).toContain(
      "github.event.pull_request.user.login != 'dependabot[bot]'",
    );
    expect(
      sonar?.steps.some((step) => step.run?.includes("pnpm install")),
    ).toBe(false);
    for (const [name, job] of Object.entries(validation.jobs)) {
      if (name !== "sonar") {
        expect(JSON.stringify(job)).not.toContain("secrets.");
      }
    }
  });

  it("requires both integration endpoints at PR and publication test boundaries", () => {
    for (const job of [
      validation.jobs["validate"],
      release.jobs["validate-and-generate"],
    ]) {
      const integration = job?.steps.find(
        (step) => step.env?.["IAM_INTEGRATION_DATABASE_URL"],
      );
      expect(integration?.env?.["IAM_INTEGRATION_DATABASE_URL"]).toContain(
        "/iam_refactor_test",
      );
      expect(integration?.env?.["IAM_INTEGRATION_REDIS_URL"]).toMatch(
        /^redis:/,
      );
      expect(integration?.run).toContain("pnpm test");
    }
  });
});
