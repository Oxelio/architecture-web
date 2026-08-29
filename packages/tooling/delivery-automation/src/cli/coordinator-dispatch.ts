import { access, readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import { resolveActivationContext } from "../config/activation-context.js";
import { parseActivationManifest } from "../config/activation-manifest.js";
import { planTaskDispatch } from "../control/coordinator.js";
import { readTaskDispatchCandidate } from "../github/github-operational-state.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import { readAuthorizedWorkIntegrationTarget } from "../github/work-integration-target.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function positiveInteger(name: string): number {
  const raw = requiredEnvironment(name);
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

async function findRepositoryRoot(start: string): Promise<string> {
  let current = resolve(start);
  const filesystemRoot = parse(current).root;
  while (true) {
    try {
      await access(join(current, "pnpm-workspace.yaml"));
      return current;
    } catch {
      if (current === filesystemRoot) {
        throw new Error("Could not locate repository root");
      }
      current = dirname(current);
    }
  }
}

async function readManifest(): Promise<
  ReturnType<typeof parseActivationManifest>
> {
  const root = await findRepositoryRoot(process.cwd());
  const raw = await readFile(
    join(root, ".github/delivery-automation.json"),
    "utf8",
  );
  return parseActivationManifest(JSON.parse(raw) as unknown);
}

function blocked(reason: unknown): void {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", mutationRequested: false, reason }, null, 2)}\n`,
  );
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const projectsToken = requiredEnvironment("ARCHITECTURE_WEB_PROJECTS_TOKEN");
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const workNumber = positiveInteger("WORK_NUMBER");
  const taskNumber = positiveInteger("TASK_NUMBER");
  const executorRoute = process.env["EXECUTOR_ROUTE"]?.trim() || "agent:codex";
  const manifest = await readManifest();

  if (!manifest.project) {
    blocked("PROJECT_LOCATOR_INACTIVE");
    return;
  }

  const inventory = await readGitHubInventory({
    repository,
    projectsToken,
    repositoryToken,
  });
  const activation = resolveActivationContext({
    repository,
    manifest,
    inventory,
  });
  if (activation.status === "blocked") {
    blocked(activation.blockers);
    return;
  }

  const candidate = await readTaskDispatchCandidate({
    repository,
    projectId: activation.project.id,
    projectsToken,
    repositoryToken,
    workNumber,
    taskNumber,
    activation: activation.activation,
  });
  const plan = planTaskDispatch({ candidate, executorRoute });
  if (!plan.dispatchRequested || !plan.targetRef) {
    blocked(plan.decision.blockers);
    return;
  }

  const target = await readAuthorizedWorkIntegrationTarget({
    repository,
    workNumber,
    repositoryToken,
    active: activation.activation.workIntegrationPr,
  });
  if (target.status !== "selected") {
    blocked(target);
    return;
  }
  if (target.target.headRef !== plan.targetRef) {
    blocked("WORK_INTEGRATION_TARGET_CHANGED_DURING_PLANNING");
    return;
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "authorized",
        mutationRequested: false,
        workNumber,
        taskNumber,
        executorRoute,
        target: target.target,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `delivery coordinator dispatch authorization failed: ${message}\n`,
  );
  process.exitCode = 1;
});
