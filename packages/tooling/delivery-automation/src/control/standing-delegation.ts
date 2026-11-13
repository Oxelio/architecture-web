import type { WorkIntegrationContext } from "./work-integration-request.js";

const repositoryId = 1336937640;
const workflowPath = ".github/workflows/delivery-work-integration-request.yml";

export async function readStandingDelegation(input: {
  readonly context: Omit<WorkIntegrationContext, "actorId">;
  readonly controllerBotId: number;
  readonly now: number;
  // The reader must verify the current direct maintainer record on Work #115.
  readonly readMaintainerRecord: () => Promise<unknown>;
}) {
  const { context, controllerBotId, now } = input;
  if (
    context.repository.toLowerCase() !== "oxelio/architecture-web" ||
    context.repositoryId !== repositoryId ||
    context.ref !== "refs/heads/main" ||
    context.runAttempt !== "1" ||
    !/^[0-9a-f]{40}$/u.test(context.workflowSha) ||
    !Number.isSafeInteger(controllerBotId) ||
    controllerBotId <= 0 ||
    !Number.isFinite(now)
  ) {
    return null;
  }

  try {
    const value = await input.readMaintainerRecord();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const expiresAt = record["expiresAt"];
    if (
      record["kind"] !== "standing-work-integration" ||
      record["repositoryId"] !== repositoryId ||
      record["controllerBotId"] !== controllerBotId ||
      record["workflowPath"] !== workflowPath ||
      typeof record["gatePublication"] !== "boolean" ||
      typeof record["nativeSquash"] !== "boolean" ||
      typeof expiresAt !== "string" ||
      !(Date.parse(expiresAt) > now)
    ) {
      return null;
    }
    return {
      repositoryId,
      controllerBotId,
      workflowSha: context.workflowSha,
      gatePublication: record["gatePublication"],
      nativeSquash: record["nativeSquash"],
    };
  } catch {
    return null;
  }
}
