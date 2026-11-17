import { resolveActivationContext } from "../config/activation-context.js";
import { authorizeWorkIntegrationEvaluation } from "../control/work-integration-request.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import {
  evaluateScopedWorkGate,
  type WorkGateEvaluationGrant,
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
  workNumber: positiveInteger("GATE_WORK_NUMBER"),
  pullNumber: positiveInteger("GATE_PULL_NUMBER"),
  headSha: requiredEnvironment("GATE_HEAD_SHA"),
  baseSha: requiredEnvironment("GATE_BASE_SHA"),
};
const grant = authorizeWorkIntegrationEvaluation(
  {
    repository,
    repositoryId,
    actorId,
    ref: requiredEnvironment("GITHUB_REF"),
    workflowSha: requiredEnvironment("TRUSTED_WORKFLOW_SHA"),
    runAttempt: requiredEnvironment("GITHUB_RUN_ATTEMPT"),
  },
  {
    kind: "maintainer-dispatch",
    candidate,
    grant: JSON.parse(
      requiredEnvironment("DELIVERY_EVALUATED_GATE_EVIDENCE"),
    ) as WorkGateEvaluationGrant | null,
  },
  Date.now(),
);
if (!grant) {
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
