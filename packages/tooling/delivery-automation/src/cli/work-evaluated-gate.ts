import { resolveActivationContext } from "../config/activation-context.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import {
  evaluateScopedWorkGate,
  type MergeCandidate,
  type WorkMergeGrant,
} from "../github/work-merge-publisher.js";
import {
  positiveInteger,
  readActivationManifest,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";
import { requireTrustedMain } from "./work-pilot-support.js";

requireTrustedMain("workflow_dispatch");
const repository = requiredEnvironment("GITHUB_REPOSITORY");
const repositoryId = positiveInteger("GITHUB_REPOSITORY_ID");
const actorId = positiveInteger("GITHUB_ACTOR_ID");
const candidate = {
  workNumber: positiveInteger("PILOT_WORK_NUMBER"),
  pullNumber: positiveInteger("PILOT_PULL_NUMBER"),
  headSha: requiredEnvironment("PILOT_HEAD_SHA"),
  baseSha: requiredEnvironment("PILOT_BASE_SHA"),
};
const grant = JSON.parse(
  requiredEnvironment("DELIVERY_EVALUATED_GATE_EVIDENCE"),
) as (WorkMergeGrant & MergeCandidate & { readonly expiresAt: string }) | null;
if (
  actorId !== 83680141 ||
  grant?.actorId !== actorId ||
  grant.repositoryId !== repositoryId ||
  grant.workNumber !== candidate.workNumber ||
  grant.pullNumber !== candidate.pullNumber ||
  grant.headSha !== candidate.headSha ||
  grant.baseSha !== candidate.baseSha ||
  candidate.baseSha !== requiredEnvironment("TRUSTED_WORKFLOW_SHA") ||
  !(Date.parse(grant.expiresAt) > Date.now())
) {
  throw new Error("EVALUATED_GATE_NOT_AUTHORIZED");
}
const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
const projectsToken = requiredEnvironment(
  "DELIVERY_OBSERVATION_PROJECTS_TOKEN",
);
const manifest = await readActivationManifest();
const inventory = await readGitHubInventory({
  repository,
  projectsToken,
  repositoryToken,
});
const activation = resolveActivationContext({
  repository,
  manifest,
  inventory,
});
if (activation.status === "blocked") {
  throw new Error("PROJECT_OPERATIONAL_OWNER_UNAVAILABLE");
}
const result = await evaluateScopedWorkGate(
  {
    repository,
    actorId,
    repositoryId,
    projectId: activation.project.id,
    projectsToken,
    repositoryToken,
    activation: activation.activation,
    readGrant: async () => grant,
  },
  candidate,
);
writeJson({ candidate, result, expiresAt: grant.expiresAt });
