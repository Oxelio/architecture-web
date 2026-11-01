import { access, readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import { parseActivationManifest } from "../config/activation-manifest.js";
import { verifyAuthorizedWorkIntegrationTarget } from "../github/work-integration-target.js";

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

async function main(): Promise<void> {
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const workNumber = positiveInteger("WORK_NUMBER");
  const root = await findRepositoryRoot(process.cwd());
  const manifest = parseActivationManifest(
    JSON.parse(
      await readFile(join(root, ".github/delivery-automation.json"), "utf8"),
    ) as unknown,
  );

  if (manifest.mappings.workIntegrationPr.status !== "verified") {
    process.stdout.write(
      `${JSON.stringify({ status: "blocked", reason: "WORK_INTEGRATION_PR_OWNER_INACTIVE" })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  const result = await verifyAuthorizedWorkIntegrationTarget({
    repository,
    workNumber,
    repositoryToken,
    active: true,
    expected: {
      pullRequestNumber: positiveInteger("EXPECTED_PR_NUMBER"),
      headRef: requiredEnvironment("EXPECTED_HEAD_REF"),
      headSha: requiredEnvironment("EXPECTED_HEAD_SHA"),
      baseRef: requiredEnvironment("EXPECTED_BASE_REF"),
    },
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "verified") {
    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`delivery target verification failed: ${message}\n`);
  process.exitCode = 1;
}
