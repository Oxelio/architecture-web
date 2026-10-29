import { access, readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import { resolveActivationContext } from "../config/activation-context.js";
import { parseActivationManifest } from "../config/activation-manifest.js";
import { planReadyQueue, planTaskDispatch } from "../control/coordinator.js";
import {
  readTaskDispatchCandidate,
  readWorkPullCandidates,
} from "../github/github-operational-state.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function optionalPositiveInteger(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0 || String(value) !== raw) {
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
        throw new Error(
          `Could not locate repository root from '${start}': pnpm-workspace.yaml was not found`,
        );
      }
      current = dirname(current);
    }
  }
}

async function readManifest(): Promise<
  ReturnType<typeof parseActivationManifest>
> {
  const override = process.env["ARCHITECTURE_WEB_ACTIVATION_MANIFEST"]?.trim();
  const path = override
    ? resolve(process.cwd(), override)
    : join(
        await findRepositoryRoot(process.cwd()),
        ".github/delivery-automation.json",
      );
  const raw = await readFile(path, "utf8");
  return parseActivationManifest(JSON.parse(raw) as unknown);
}

function writeResult(result: unknown, blocked = false): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (blocked) {
    process.exitCode = 2;
  }
}

async function main(): Promise<void> {
  const repository = requireEnvironment("GITHUB_REPOSITORY");
  const mode = process.env["COORDINATOR_MODE"]?.trim() || "ready-queue";
  if (mode !== "ready-queue" && mode !== "task-dispatch") {
    throw new Error(
      "COORDINATOR_MODE must be 'ready-queue' or 'task-dispatch'",
    );
  }

  const manifest = await readManifest();
  if (!manifest.project) {
    writeResult(
      {
        mode,
        status: "blocked",
        blockers: ["PROJECT_LOCATOR_INACTIVE"],
        mutationRequested: false,
      },
      true,
    );
    return;
  }

  const projectsToken = process.env["ARCHITECTURE_WEB_PROJECTS_TOKEN"]?.trim();
  if (!projectsToken) {
    writeResult(
      {
        mode,
        status: "blocked",
        blockers: ["PROJECT_CREDENTIAL_UNAVAILABLE"],
        mutationRequested: false,
      },
      true,
    );
    return;
  }

  const repositoryToken = requireEnvironment("GITHUB_TOKEN");
  const inventory = await readGitHubInventory({
    repository,
    projectsToken,
    repositoryToken,
  });
  const context = resolveActivationContext({ repository, manifest, inventory });
  if (context.status === "blocked") {
    writeResult(
      {
        mode,
        status: "blocked",
        blockers: context.blockers,
        mutationRequested: false,
      },
      true,
    );
    return;
  }

  const executorRoute = process.env["EXECUTOR_ROUTE"]?.trim();
  if (!executorRoute) {
    writeResult(
      {
        mode,
        status: "blocked",
        blockers: ["EXECUTOR_ROUTE_UNSPECIFIED"],
        mutationRequested: false,
      },
      true,
    );
    return;
  }

  if (mode === "ready-queue") {
    const candidates = await readWorkPullCandidates({
      repository,
      projectId: context.project.id,
      projectsToken,
      repositoryToken,
      activation: context.activation,
    });
    writeResult({
      status: "observed",
      mutationRequested: false,
      plan: planReadyQueue({ candidates, executorRoute }),
    });
    return;
  }

  const workNumber = optionalPositiveInteger("WORK_NUMBER");
  const taskNumber = optionalPositiveInteger("TASK_NUMBER");
  if (!workNumber || !taskNumber) {
    throw new Error(
      "WORK_NUMBER and TASK_NUMBER are required for task-dispatch mode",
    );
  }

  const candidate = await readTaskDispatchCandidate({
    repository,
    projectId: context.project.id,
    projectsToken,
    repositoryToken,
    workNumber,
    taskNumber,
    activation: context.activation,
  });
  writeResult({
    status: "observed",
    mutationRequested: false,
    plan: planTaskDispatch({ candidate, executorRoute }),
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`delivery coordinator dry-run failed: ${message}\n`);
  process.exitCode = 1;
});
