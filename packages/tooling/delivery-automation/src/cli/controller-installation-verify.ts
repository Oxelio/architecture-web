import { verifyControllerInstallation } from "../github/controller-installation.js";
import {
  positiveInteger,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";
import { requireTrustedMain } from "./work-pilot-support.js";

requireTrustedMain("workflow_dispatch");

const installation = await verifyControllerInstallation({
  token: requiredEnvironment("CONTROLLER_INSTALLATION_TOKEN"),
  appSlug: requiredEnvironment("CONTROLLER_APP_SLUG"),
  expectedAppSlug: "architecture-web-work-controller",
  installationId: positiveInteger("CONTROLLER_INSTALLATION_ID"),
  expectedInstallationId: positiveInteger(
    "EXPECTED_CONTROLLER_INSTALLATION_ID",
  ),
});

if (!installation) {
  writeJson({ status: "denied", reason: "CONTROLLER_INSTALLATION_UNVERIFIED" });
  process.exitCode = 2;
} else {
  writeJson({ status: "verified", ...installation });
}
