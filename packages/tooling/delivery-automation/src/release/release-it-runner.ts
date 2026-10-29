// Isolate release-it's cwd-sensitive Git readers from the caller and test worker.
import { readFileSync, writeFileSync } from "node:fs";

import * as releaseItModule from "release-it";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  throw new Error("Release-it runner requires config and result paths");
}
const releaseIt = (
  releaseItModule as unknown as {
    default: (config: unknown) => Promise<unknown>;
  }
).default;
const result: unknown = await releaseIt(
  JSON.parse(readFileSync(input, "utf8")) as unknown,
);
writeFileSync(output, JSON.stringify(result));
