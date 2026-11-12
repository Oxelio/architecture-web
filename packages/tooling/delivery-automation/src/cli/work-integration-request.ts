import { readFile } from "node:fs/promises";

import { readStandingIntegrationWakeup } from "../control/standing-integration-wakeup.js";
import {
  authenticateDirectSquashRequest,
  type DirectSquashEvent,
} from "../github/direct-squash-request.js";
import { readAuthorizedWorkIntegrationTarget } from "../github/work-integration-target.js";
import type { MergeCandidate } from "../github/work-merge-publisher.js";
import {
  positiveInteger,
  readActivationManifest,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";
import {
  githubRepositoryRequest,
  readMaintainerRecord,
  requireTrustedMain,
} from "./work-pilot-support.js";

requireTrustedMain("issue_comment", "workflow_run");
const event: unknown = JSON.parse(
  await readFile(requiredEnvironment("GITHUB_EVENT_PATH"), "utf8"),
);
if (process.env["GITHUB_EVENT_NAME"] === "workflow_run") {
  const result =
    process.env["DELIVERY_STANDING_REQUESTS_ENABLED"] === "true"
      ? await readStandingIntegrationWakeup({
          event: event as Parameters<
            typeof readStandingIntegrationWakeup
          >[0]["event"],
          trustedMainSha: requiredEnvironment("TRUSTED_WORKFLOW_SHA"),
          readPull: (number) => githubRepositoryRequest(`/pulls/${number}`),
          ownsCandidate: workOwnsCandidate,
        })
      : { status: "inactive" };
  writeJson(result);
} else {
  const outcome = await authenticateDirectSquashRequest({
    event: event as DirectSquashEvent,
    ref: requiredEnvironment("GITHUB_REF"),
    runAttempt: requiredEnvironment("GITHUB_RUN_ATTEMPT"),
    actorId: positiveInteger("GITHUB_ACTOR_ID"),
    now: Date.now(),
    readComment: (id) => githubRepositoryRequest(`/issues/comments/${id}`),
    readCandidate: (number) => githubRepositoryRequest(`/pulls/${number}`),
    readGrant: () =>
      readMaintainerRecord("DELIVERY_DIRECT_GRANT_COMMENT_ID", 91),
    workOwnsCandidate,
  });
  writeJson(outcome);
  if (outcome.status === "blocked") {
    process.exitCode = 2;
  }
}

async function workOwnsCandidate(candidate: MergeCandidate): Promise<boolean> {
  const manifest = await readActivationManifest();
  const [target, main] = await Promise.all([
    readAuthorizedWorkIntegrationTarget({
      repository: "Oxelio/architecture-web",
      workNumber: candidate.workNumber,
      repositoryToken: requiredEnvironment("GITHUB_TOKEN"),
      active: manifest.mappings.workIntegrationPr.status === "verified",
    }),
    githubRepositoryRequest<{ readonly commit: { readonly sha: string } }>(
      "/branches/main",
    ),
  ]);
  return (
    target.status === "selected" &&
    target.target.pullRequestNumber === candidate.pullNumber &&
    target.target.headSha === candidate.headSha &&
    main.commit.sha === candidate.baseSha
  );
}
