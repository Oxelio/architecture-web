import { verifyDeliveryActivation } from "../config/activation-verification.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import { probeNativeDeliveryCapabilities } from "../github/native-capability-probe.js";
import type { ExplicitProjectLocator } from "../inventory/project-inventory.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function positiveInteger(value: string, name: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
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
  return {
    owner,
    number: positiveInteger(number, "ARCHITECTURE_WEB_PROJECT_NUMBER"),
  };
}

async function main(): Promise<void> {
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const projectsToken = requiredEnvironment("ARCHITECTURE_WEB_PROJECTS_TOKEN");
  const repositoryToken = process.env["GITHUB_TOKEN"]?.trim() || projectsToken;
  const evidenceRef = requiredEnvironment("ACTIVATION_EVIDENCE_REF");
  const probeIssueNumber = positiveInteger(
    requiredEnvironment("ACTIVATION_PROBE_ISSUE"),
    "ACTIVATION_PROBE_ISSUE",
  );
  const locator = explicitProjectLocator();

  const [inventory, nativeCapabilities] = await Promise.all([
    readGitHubInventory({
      repository,
      projectsToken,
      repositoryToken,
    }),
    probeNativeDeliveryCapabilities({
      repository,
      issueNumber: probeIssueNumber,
      repositoryToken,
    }),
  ]);

  const result = verifyDeliveryActivation({
    repository,
    inventory,
    nativeCapabilities,
    evidenceRef,
    ...(locator ? { explicitProject: locator } : {}),
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === "blocked") {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`delivery activation verification failed: ${message}\n`);
  process.exitCode = 1;
});
