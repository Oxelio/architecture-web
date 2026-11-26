import { access, readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import { parseActivationManifest } from "../config/activation-manifest.js";

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
