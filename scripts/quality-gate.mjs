import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runQualityCli } from "./pr-validation-evidence.mjs";

export function qualityGate({
  event,
  validation,
  dependencyReview,
  commitlint,
  mode = "full",
  evidence,
}) {
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
  runQualityCli(qualityGate).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
