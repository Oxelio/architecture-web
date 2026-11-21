import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type QualityInputs, runQualityCli } from "./pr-validation-evidence.ts";

export function qualityGate({
  event,
  validation,
  dependencyReview,
  commitlint,
  mode = "full",
  evidence,
}: QualityInputs) {
  const pr = event === "pull_request";
  if (mode === "metadata") {
    return (
      pr &&
      validation === "skipped" &&
      dependencyReview === "skipped" &&
      commitlint === "success" &&
      evidence?.verified === true
    );
  }
  return (
    mode === "full" &&
    event !== undefined &&
    ["pull_request", "push", "workflow_dispatch"].includes(event) &&
    validation === "success" &&
    dependencyReview === (pr ? "success" : "skipped") &&
    commitlint === (pr ? "success" : "skipped")
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await runQualityCli(qualityGate);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
