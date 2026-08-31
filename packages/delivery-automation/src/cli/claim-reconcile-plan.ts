import { access, readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import { resolveActivationContext } from "../config/activation-context.js";
import { parseActivationManifest } from "../config/activation-manifest.js";
import { planClaimReconciliation } from "../github/claim-reconciliation.js";
import { readProjectWorkItems } from "../github/github-operational-state.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

async function findRepositoryRoot(start: string): Promise<string> {
  let current = resolve(start);
  const root = parse(current).root;
  while (true) {
    try {
      await access(join(current, "pnpm-workspace.yaml"));
      return current;
    } catch {
      if (current === root) {
        throw new Error("Could not locate repository root");
      }
      current = dirname(current);
    }
  }
}

async function main(): Promise<void> {
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const projectsToken = requiredEnvironment("ARCHITECTURE_WEB_PROJECTS_TOKEN");
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const root = await findRepositoryRoot(process.cwd());
  const manifest = parseActivationManifest(
    JSON.parse(
      await readFile(join(root, ".github/delivery-automation.json"), "utf8"),
    ) as unknown,
  );

  if (!manifest.project || manifest.mappings.taskClaim.status !== "verified") {
    process.stdout.write(
      `${JSON.stringify({ status: "blocked", releasable: [], reason: "TASK_CLAIM_OWNER_INACTIVE" })}\n`,
    );
    process.exitCode = 2;
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
    process.stdout.write(
      `${JSON.stringify({ status: "blocked", releasable: [], reason: activation.blockers })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  const items = await readProjectWorkItems({
    repository,
    projectId: activation.project.id,
    projectsToken,
  });
  const plan = await planClaimReconciliation({
    repository,
    repositoryToken,
    items,
  });

  process.stdout.write(
    `${JSON.stringify({ status: "observed", ...plan }, null, 2)}\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`claim reconciliation planning failed: ${message}\n`);
  process.exitCode = 1;
});
