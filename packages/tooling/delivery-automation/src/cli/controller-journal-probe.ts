import { verifyControllerInstallation } from "../github/controller-installation.js";
import { verifyControllerJournalEnforcement } from "../github/controller-journal-probe.js";
import {
  positiveInteger,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";
import {
  githubRepositoryRequest,
  requireTrustedMain,
} from "./work-pilot-support.js";

requireTrustedMain("workflow_dispatch");
if (
  positiveInteger("GITHUB_ACTOR_ID") !== 83680141 ||
  requiredEnvironment("GITHUB_WORKFLOW_REF") !==
    "Oxelio/architecture-web/.github/workflows/delivery-work-controller-identity.yml@refs/heads/main"
) {
  throw new Error(
    "The journal probe requires the direct maintainer on the protected workflow",
  );
}

const main = await githubRepositoryRequest<{ commit: { sha: string } }>(
  "/branches/main",
);
const mainSha = requiredEnvironment("TRUSTED_WORKFLOW_SHA");
if (main.commit.sha !== mainSha) {
  throw new Error("The journal probe must run from the current main revision");
}
const commit = await githubRepositoryRequest<{
  sha: string;
  parents: readonly { sha: string }[];
}>(`/commits/${mainSha}`);
const parent = commit.parents[0]?.sha;
if (commit.sha !== mainSha || !parent) {
  throw new Error(
    "Could not read the current revision's parent for the update probe",
  );
}

const token = requiredEnvironment("CONTROLLER_INSTALLATION_TOKEN");
const installation = await verifyControllerInstallation({
  token,
  appSlug: requiredEnvironment("CONTROLLER_APP_SLUG"),
  expectedAppSlug: "architecture-web-work-controller",
  installationId: positiveInteger("CONTROLLER_INSTALLATION_ID"),
  expectedInstallationId: positiveInteger(
    "EXPECTED_CONTROLLER_INSTALLATION_ID",
  ),
});
if (!installation) {
  throw new Error("Controller installation could not be verified");
}
const result = await verifyControllerJournalEnforcement({
  runId: positiveInteger("GITHUB_RUN_ID"),
  mainSha,
  parentSha: parent,
  workflowToken: requiredEnvironment("GITHUB_TOKEN"),
  controllerToken: token,
});
writeJson({ status: "verified", ...installation, ...result });
