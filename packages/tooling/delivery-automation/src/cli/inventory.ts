import { readGitHubInventory } from "../github/github-project-inventory.js";
import { architectureWebDeliveryExpectations } from "../inventory/delivery-expectations.js";
import {
  buildInventoryReport,
  type ExplicitProjectLocator,
} from "../inventory/project-inventory.js";

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function readExplicitProject(): ExplicitProjectLocator | undefined {
  const owner = process.env["ARCHITECTURE_WEB_PROJECT_OWNER"]?.trim();
  const rawNumber = process.env["ARCHITECTURE_WEB_PROJECT_NUMBER"]?.trim();

  if (!owner && !rawNumber) {
    return undefined;
  }
  if (!owner || !rawNumber) {
    throw new Error(
      "ARCHITECTURE_WEB_PROJECT_OWNER and ARCHITECTURE_WEB_PROJECT_NUMBER must be provided together",
    );
  }

  const number = Number.parseInt(rawNumber, 10);
  if (
    !Number.isInteger(number) ||
    number <= 0 ||
    String(number) !== rawNumber
  ) {
    throw new Error(
      "ARCHITECTURE_WEB_PROJECT_NUMBER must be a positive integer",
    );
  }

  return { owner, number };
}

async function main(): Promise<void> {
  const repository = requireEnvironment("GITHUB_REPOSITORY");
  const projectsToken = requireEnvironment("ARCHITECTURE_WEB_PROJECTS_TOKEN");
  const repositoryToken = process.env["GITHUB_TOKEN"]?.trim();
  const explicitProject = readExplicitProject();

  const inventory = await readGitHubInventory({
    repository,
    projectsToken,
    ...(repositoryToken ? { repositoryToken } : {}),
  });

  const report = buildInventoryReport({
    repository,
    projects: inventory.projects,
    labels: inventory.labels,
    expectations: architectureWebDeliveryExpectations,
    ...(explicitProject ? { explicitProject } : {}),
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.inspectionStatus === "blocked") {
    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`delivery inventory failed: ${message}\n`);
  process.exitCode = 1;
}
