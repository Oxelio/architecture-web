import { randomUUID } from "node:crypto";

import { resolveActivationContext } from "../config/activation-context.js";
import {
  evaluateTaskClaimAcquisition,
  type TaskClaimExecution,
} from "../control/eligibility.js";
import {
  readProjectWorkItems,
  readTaskDispatchCandidate,
} from "../github/github-operational-state.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import {
  acquireTaskClaim,
  releaseTaskClaim,
} from "../github/task-claim-publisher.js";
import { resolveTaskClaimTarget } from "../github/task-claim-target.js";
import { readAuthorizedWorkIntegrationTarget } from "../github/work-integration-target.js";
import { readActivationManifest } from "./gate-publication-support.js";

type ClaimExecutionKind = TaskClaimExecution["kind"];

interface CliArguments {
  readonly action: "acquire" | "release";
  readonly workNumber: number;
  readonly taskNumber: number;
  readonly claimant?: string;
  readonly runId?: string;
  readonly generation?: string;
  readonly executionKind?: ClaimExecutionKind;
  readonly executorRoute?: string;
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

function claimExecutionKind(
  value: string | undefined,
): ClaimExecutionKind | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== "human" && value !== "automated") {
    throw new Error("--execution-kind must be either human or automated");
  }
  return value;
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
  const executionKind = claimExecutionKind(values.get("execution-kind"));
  const executorRoute = values.get("executor-route");

  return {
    action: actionValue,
    workNumber: positiveInteger(values.get("work"), "work"),
    taskNumber: positiveInteger(values.get("task"), "task"),
    ...(claimant ? { claimant } : {}),
    ...(runId ? { runId } : {}),
    ...(generation ? { generation } : {}),
    ...(executionKind ? { executionKind } : {}),
    ...(executorRoute ? { executorRoute } : {}),
  };
}

function claimExecution(args: CliArguments): TaskClaimExecution {
  if (!args.executionKind) {
    throw new Error("--execution-kind is required for acquire");
  }

  if (args.executionKind === "human") {
    if (args.executorRoute) {
      throw new Error(
        "--executor-route must not be supplied for a human claim",
      );
    }
    return { kind: "human" };
  }

  if (!args.executorRoute) {
    throw new Error("--executor-route is required for an automated claim");
  }
  if (!args.executorRoute.startsWith("agent:")) {
    throw new Error("--executor-route must use the agent:* namespace");
  }

  return { kind: "automated", executorRoute: args.executorRoute };
}

function blocked(reason: string, blockers?: readonly string[]): void {
  console.log(
    JSON.stringify({
      status: "blocked",
      reason,
      ...(blockers ? { blockers } : {}),
    }),
  );
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const projectsToken = requiredEnvironment("ARCHITECTURE_WEB_PROJECTS_TOKEN");
  const repositoryToken = process.env["GITHUB_TOKEN"]?.trim() || projectsToken;

  const manifest = await readActivationManifest();
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
    blocked("DELIVERY_ACTIVATION_UNAVAILABLE", activation.blockers);
    return;
  }
  if (!activation.activation.taskClaim) {
    blocked("TASK_CLAIM_OWNER_INACTIVE");
    return;
  }

  if (args.action === "acquire") {
    validateAcquisitionArguments(args);

    const execution = claimExecution(args);
    const candidate = await readTaskDispatchCandidate({
      repository,
      projectId: activation.project.id,
      projectsToken,
      repositoryToken,
      workNumber: args.workNumber,
      taskNumber: args.taskNumber,
      activation: activation.activation,
    });
    const decision = evaluateTaskClaimAcquisition(candidate, execution);
    if (!decision.eligible || !decision.targetRef) {
      blocked("CLAIM_ACQUISITION_PRECONDITIONS_BLOCKED", decision.blockers);
      return;
    }

    const authorizedTarget = await readAuthorizedWorkIntegrationTarget({
      repository,
      workNumber: args.workNumber,
      repositoryToken,
      active: activation.activation.workIntegrationPr,
    });
    if (authorizedTarget.status !== "selected") {
      blocked("WORK_INTEGRATION_TARGET_UNAVAILABLE");
      return;
    }
    if (authorizedTarget.target.headRef !== decision.targetRef) {
      blocked("WORK_INTEGRATION_TARGET_CHANGED_DURING_CLAIM");
      return;
    }

    const workItems = await readProjectWorkItems({
      repository,
      projectId: activation.project.id,
      projectsToken,
    });
    const target = resolveTaskClaimTarget({
      project: activation.project,
      workItems,
      workNumber: args.workNumber,
    });
    const result = await acquireTaskClaim({
      target,
      record: {
        taskNumber: args.taskNumber,
        claimant: args.claimant,
        generation: randomUUID(),
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

  if (args.executionKind || args.executorRoute) {
    throw new Error(
      "--execution-kind and --executor-route are acquire-only options",
    );
  }
  if (!args.generation) {
    throw new Error("--generation is required for release");
  }

  const workItems = await readProjectWorkItems({
    repository,
    projectId: activation.project.id,
    projectsToken,
  });
  const target = resolveTaskClaimTarget({
    project: activation.project,
    workItems,
    workNumber: args.workNumber,
  });
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

function validateAcquisitionArguments(
  args: CliArguments,
): asserts args is CliArguments & { claimant: string } {
  if (!args.claimant) {
    throw new Error("--claimant is required for acquire");
  }
  if (args.generation) {
    throw new Error(
      "--generation must not be supplied for acquire; the trusted publisher generates it",
    );
  }
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
