import { access, readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import { parseActivationManifest } from "../config/activation-manifest.js";

export interface RecordedAssertion {
  readonly satisfied: boolean;
  readonly evidenceRef: string | null;
}

export function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export function optionalEnvironment(name: string): string | null {
  return process.env[name]?.trim() || null;
}

export function positiveInteger(name: string): number {
  const raw = requiredEnvironment(name);
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function booleanEnvironment(name: string): boolean {
  const raw = requiredEnvironment(name).toLowerCase();
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  throw new Error(`${name} must be 'true' or 'false'`);
}

export function recordedAssertion(input: {
  readonly valueName: string;
  readonly evidenceRefName: string;
}): RecordedAssertion {
  const satisfied = booleanEnvironment(input.valueName);
  const evidenceRef = optionalEnvironment(input.evidenceRefName);
  if (satisfied && !evidenceRef) {
    throw new Error(
      `${input.evidenceRefName} is required when ${input.valueName}=true`,
    );
  }
  return { satisfied, evidenceRef };
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

export async function readActivationManifest(): Promise<
  ReturnType<typeof parseActivationManifest>
> {
  const root = await findRepositoryRoot(process.cwd());
  const raw = await readFile(
    join(root, ".github/delivery-automation.json"),
    "utf8",
  );
  return parseActivationManifest(JSON.parse(raw) as unknown);
}

export function markdownValue(value: string | null): string {
  if (!value) {
    return "—";
  }
  return value
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replaceAll("|", String.raw`\|`);
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
