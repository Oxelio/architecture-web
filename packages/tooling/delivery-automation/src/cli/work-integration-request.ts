import { readFile } from "node:fs/promises";

import {
  authenticateDirectSquashRequest,
  type DirectSquashEvent,
} from "../github/direct-squash-request.js";
import { readAuthorizedWorkIntegrationTarget } from "../github/work-integration-target.js";
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

requireTrustedMain("issue_comment");
const event = JSON.parse(
  await readFile(requiredEnvironment("GITHUB_EVENT_PATH"), "utf8"),
) as DirectSquashEvent;
const outcome = await authenticateDirectSquashRequest({
  event,
  ref: requiredEnvironment("GITHUB_REF"),
  runAttempt: requiredEnvironment("GITHUB_RUN_ATTEMPT"),
  actorId: positiveInteger("GITHUB_ACTOR_ID"),
  now: Date.now(),
  readComment: (id) => githubRepositoryRequest(`/issues/comments/${id}`),
  readCandidate: (number) => githubRepositoryRequest(`/pulls/${number}`),
  readGrant: () => readMaintainerRecord("DELIVERY_DIRECT_GRANT_COMMENT_ID", 91),
  workOwnsCandidate: async (candidate) => {
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
  },
});
writeJson(outcome);
if (outcome.status === "blocked") {
  process.exitCode = 2;
}
