import { randomUUID } from "node:crypto";

import { readProjectWorkItems } from "../github/github-operational-state.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import {
  acquireTaskClaim,
  releaseTaskClaim,
} from "../github/task-claim-publisher.js";
import { resolveTaskClaimTarget } from "../github/task-claim-target.js";
import {
  type ExplicitProjectLocator,
  selectProject,
} from "../inventory/project-inventory.js";

interface CliArguments {
  readonly action: "acquire" | "release";
  readonly workNumber: number;
  readonly taskNumber: number;
  readonly claimant?: string;
  readonly runId?: string;
  readonly generation?: string;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function positiveInteger(value: string | undefined, name: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`--${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function flagValues(argv: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    values.set(token.slice(2), value);
    index += 1;
  }
  return values;
}

function parseArguments(argv: readonly string[]): CliArguments {
  const [actionValue, ...rest] = argv;
  if (actionValue !== "acquire" && actionValue !== "release") {
    throw new Error(
      "Usage: task-claim <acquire|release> --work N --task N [options]",
    );
  }
  const values = flagValues(rest);
  const claimant = values.get("claimant");
  const runId = values.get("run");
  const generation = values.get("generation");

  return {
    action: actionValue,
    workNumber: positiveInteger(values.get("work"), "work"),
    taskNumber: positiveInteger(values.get("task"), "task"),
    ...(claimant ? { claimant } : {}),
    ...(runId ? { runId } : {}),
    ...(generation ? { generation } : {}),
  };
}

function explicitProjectLocator(): ExplicitProjectLocator | undefined {
  const owner = process.env["ARCHITECTURE_WEB_PROJECT_OWNER"]?.trim();
  const number = process.env["ARCHITECTURE_WEB_PROJECT_NUMBER"]?.trim();
  if (!owner && !number) {
    return undefined;
  }
  if (!owner || !number) {
    throw new Error(
      "ARCHITECTURE_WEB_PROJECT_OWNER and ARCHITECTURE_WEB_PROJECT_NUMBER must be supplied together",
    );
  }
  return { owner, number: positiveInteger(number, "project-number") };
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const projectsToken = requiredEnvironment("ARCHITECTURE_WEB_PROJECTS_TOKEN");
  const repositoryToken = process.env["GITHUB_TOKEN"]?.trim() || projectsToken;

  const inventory = await readGitHubInventory({
    repository,
    projectsToken,
    repositoryToken,
  });
  const selection = selectProject(
    repository,
    inventory.projects,
    explicitProjectLocator(),
  );
  if (selection.status !== "selected") {
    throw new Error(`Project selection blocked: ${selection.blocker}`);
  }

  const workItems = await readProjectWorkItems({
    repository,
    projectId: selection.project.id,
    projectsToken,
  });
  const target = resolveTaskClaimTarget({
    project: selection.project,
    workItems,
    workNumber: args.workNumber,
  });

  if (args.action === "acquire") {
    if (!args.claimant) {
      throw new Error("--claimant is required for acquire");
    }
    const result = await acquireTaskClaim({
      target,
      record: {
        taskNumber: args.taskNumber,
        claimant: args.claimant,
        generation: args.generation ?? randomUUID(),
        runId: args.runId ?? null,
        acquiredAt: new Date().toISOString(),
      },
      projectsToken,
    });
    console.log(JSON.stringify(result));
    if (result.status === "blocked") {
      process.exitCode = 2;
    }
    return;
  }

  if (!args.generation) {
    throw new Error("--generation is required for release");
  }
  const result = await releaseTaskClaim({
    target,
    expectedTaskNumber: args.taskNumber,
    expectedGeneration: args.generation,
    projectsToken,
  });
  console.log(JSON.stringify(result));
  if (result.status === "blocked") {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
