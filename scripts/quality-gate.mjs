import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function qualityGate({
  event,
  validation,
  dependencyReview,
  commitlint,
}) {
  const pr = event === "pull_request";
  return (
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
  const results = {
    event: process.env.GITHUB_EVENT_NAME,
    validation: process.env.VALIDATION_RESULT,
    dependencyReview: process.env.DEPENDENCY_REVIEW_RESULT,
    commitlint: process.env.COMMITLINT_RESULT,
  };
  console.log(JSON.stringify(results, null, 2));
  if (!qualityGate(results)) process.exitCode = 1;
}
