// Isolate release-it's cwd-sensitive Git readers from the caller and test worker.
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import * as releaseItModule from "release-it";

if (process.argv.length !== 2) {
  throw new Error("Release-it runner does not accept arguments");
}
const input = join(process.cwd(), ".release-it-input.json");
const output = join(process.cwd(), ".release-it-result.json");
if (!lstatSync(input).isFile()) {
  throw new Error("Release-it runner requires a regular configuration file");
}
const releaseIt = (
  releaseItModule as unknown as {
    default: (config: unknown) => Promise<unknown>;
  }
).default;
const result: unknown = await releaseIt(
  JSON.parse(readFileSync(input, "utf8")) as unknown,
);
writeFileSync(output, JSON.stringify(result), { flag: "wx" });
