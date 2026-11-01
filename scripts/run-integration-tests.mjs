import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { execute, runWorkspaceTests } from "./run-workspace-tests.mjs";

export function runIntegrationTests({
  root = process.cwd(),
  env = process.env,
  run = execute,
  test = runWorkspaceTests,
} = {}) {
  const compose = ["compose", "-p", "ci-iam", "-f", "compose.iam-test.yml"];
  let status = 1;
  try {
    status = run(
      "docker",
      [...compose, "up", "-d", "--wait", "--wait-timeout", "90"],
      { cwd: root, env },
    );
    if (status === 0) {
      status = test({
        root,
        env: {
          ...env,
          TZ: "UTC",
          IAM_INTEGRATION_DATABASE_URL:
            "postgresql://iam_test:iam_test@127.0.0.1:55432/iam_refactor_test",
          IAM_INTEGRATION_REDIS_URL: "redis://127.0.0.1:56379/15",
        },
      });
    }
  } finally {
    const cleanup = run("docker", [...compose, "down", "--volumes"], {
      cwd: root,
      env,
    });
    if (status === 0 && cleanup !== 0) status = cleanup;
  }
  return status;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = runIntegrationTests();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
