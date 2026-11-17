import { verifyControllerInstallation } from "../github/controller-installation.js";
import { recordStandingDelegationRevocation } from "../github/standing-delegation-revocation.js";
import {
  type StandingRulesetObservation,
  verifyStandingJournalRules,
} from "../github/work-merge-publisher.js";
import {
  positiveInteger,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";
import {
  githubRepositoryRequest,
  readDirectMaintainerRecord,
  requireTrustedMain,
} from "./work-pilot-support.js";

requireTrustedMain("workflow_dispatch");
if (positiveInteger("GITHUB_ACTOR_ID") !== 83680141) {
  throw new Error("Ordinary revocation requires the authenticated maintainer");
}

const workflowSha = requiredEnvironment("TRUSTED_WORKFLOW_SHA");
const main = await githubRepositoryRequest<{
  readonly commit: { readonly sha: string };
}>("/branches/main");
if (
  main.commit.sha !== workflowSha ||
  requiredEnvironment("GITHUB_WORKFLOW_REF") !==
    "Oxelio/architecture-web/.github/workflows/delivery-work-controller-identity.yml@refs/heads/main"
) {
  throw new Error(
    "Standing revocation requires the current protected controller workflow",
  );
}
const commandId = positiveInteger("REVOCATION_COMMENT_ID");
const delegationCommentId = positiveInteger(
  "DELIVERY_STANDING_DELEGATION_COMMENT_ID",
);
const command = await readDirectMaintainerRecord<{
  readonly kind: string;
  readonly repositoryId: number;
  readonly delegationCommentId: number;
}>(commandId, 115);
if (
  command?.kind !== "revoke-standing-work-integration" ||
  command.repositoryId !== 1336937640 ||
  command.delegationCommentId !== delegationCommentId
) {
  throw new Error(
    "Standing revocation command does not match the configured delegation",
  );
}

const controllerToken = requiredEnvironment("CONTROLLER_INSTALLATION_TOKEN");
const installation = await verifyControllerInstallation({
  token: controllerToken,
  appSlug: requiredEnvironment("CONTROLLER_APP_SLUG"),
  expectedAppSlug: "architecture-web-work-controller",
  installationId: positiveInteger("CONTROLLER_INSTALLATION_ID"),
  expectedInstallationId: positiveInteger(
    "EXPECTED_CONTROLLER_INSTALLATION_ID",
  ),
});
const observations = JSON.parse(
  process.env["DELIVERY_CONTROLLER_RULESET_OBSERVATIONS"] || "[]",
) as readonly StandingRulesetObservation[];
if (
  !installation ||
  !Array.isArray(observations) ||
  !(await verifyStandingJournalRules(
    {
      repository: "Oxelio/architecture-web",
      repositoryId: installation.repositoryId,
      repositoryToken: requiredEnvironment("GITHUB_TOKEN"),
      readStandingRulesetObservation: async (id) => {
        const matches = observations.filter(
          (observation) => observation.rulesetId === id,
        );
        return matches.length === 1 ? (matches[0] ?? null) : null;
      },
    },
    {
      creationRulesetId: positiveInteger(
        "DELIVERY_CONTROLLER_CREATION_RULESET_ID",
      ),
      immutabilityRulesetId: positiveInteger(
        "DELIVERY_CONTROLLER_IMMUTABILITY_RULESET_ID",
      ),
      controllerAppId: 5781545,
    },
  ))
) {
  throw new Error("Controller identity or journal protection is not verified");
}

if (
  !(await recordStandingDelegationRevocation({
    repositoryToken: controllerToken,
    delegationCommentId,
    workflowSha,
  }))
) {
  throw new Error("Standing revocation not confirmed");
}
writeJson({ status: "revoked", delegationCommentId, commandId });
