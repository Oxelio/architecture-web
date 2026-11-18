import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import type { AuthoringJobBinding } from "./sealed-authoring-store.js";

export interface TrustedAuthoringJob {
  readonly audience: string;
  readonly subject: string;
  readonly workflowSha: string;
  readonly environment: string;
}

// This identity authorizes a private transport exchange only. It grants no
// controller admission, Role, write credential or recovery authority.
export function createGitHubJobAuthenticator(
  expected: TrustedAuthoringJob,
  key: JWTVerifyGetKey = createRemoteJWKSet(
    new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
    { timeoutDuration: 5000 },
  ),
) {
  if (
    !/^[a-f0-9]{40}$/u.test(expected.workflowSha) ||
    !expected.audience.startsWith("https://") ||
    !expected.environment ||
    expected.subject !==
      `repo:Oxelio/architecture-web:environment:${expected.environment}`
  ) {
    throw new Error("AUTHORING_JOB_CONFIGURATION_INVALID");
  }
  const claims = {
    repository: "Oxelio/architecture-web",
    repository_id: "1336937640",
    repository_owner_id: "83680141",
    ref: "refs/heads/main",
    workflow_ref:
      "Oxelio/architecture-web/.github/workflows/delivery-authoring.yml@refs/heads/main",
    workflow_sha: expected.workflowSha,
    environment: expected.environment,
    event_name: "workflow_dispatch",
    run_attempt: "1",
  };
  return async (token: string): Promise<AuthoringJobBinding | null> => {
    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: "https://token.actions.githubusercontent.com",
        audience: expected.audience,
        subject: expected.subject,
        algorithms: ["RS256"],
        requiredClaims: ["iat", "exp", "nbf"],
      });
      if (
        !Object.entries(claims).every(
          ([name, value]) => payload[name] === value,
        ) ||
        typeof payload["run_id"] !== "string" ||
        !/^[1-9][0-9]*$/u.test(payload["run_id"]) ||
        payload["job_workflow_ref"] !== undefined ||
        payload["job_workflow_sha"] !== undefined ||
        typeof payload.iat !== "number" ||
        payload.iat > Date.now() / 1000 ||
        typeof payload.exp !== "number" ||
        payload.iat >= payload.exp
      ) {
        return null;
      }
      return {
        runId: payload["run_id"],
        runAttempt: "1",
        workflowSha: expected.workflowSha,
      };
    } catch {
      return null;
    }
  };
}
