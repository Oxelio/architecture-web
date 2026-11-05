import { publishGateCheck } from "../github/gate-check-publisher.js";
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
if (positiveInteger("GITHUB_ACTOR_ID") !== 83680141) {
  throw new Error("The issuer probe requires the authenticated maintainer");
}

const workNumber = positiveInteger("PILOT_WORK_NUMBER");
const pullNumber = positiveInteger("PILOT_PULL_NUMBER");
const headSha = requiredEnvironment("PILOT_HEAD_SHA");
const baseSha = requiredEnvironment("PILOT_BASE_SHA");
const appId = positiveInteger("PILOT_GATE_APP_ID");
const [pr, main] = await Promise.all([
  githubRepositoryRequest<{
    readonly number: number;
    readonly state: string;
    readonly merged: boolean;
    readonly body: string | null;
    readonly head: {
      readonly sha: string;
      readonly repo?: { readonly id: number };
    };
    readonly base: {
      readonly sha: string;
      readonly ref: string;
      readonly repo?: { readonly id: number };
    };
  }>(`/pulls/${pullNumber}`),
  githubRepositoryRequest<{ readonly commit: { readonly sha: string } }>(
    "/branches/main",
  ),
]);
const references = pr.body?.match(/^Refs #[1-9]\d*\r?$/gmu);
if (
  pr.number !== pullNumber ||
  pr.state !== "open" ||
  pr.merged !== false ||
  pr.head.repo?.id !== 1336937640 ||
  pr.base.repo?.id !== 1336937640 ||
  pr.base.ref !== "main" ||
  pr.head.sha !== headSha ||
  pr.base.sha !== baseSha ||
  main.commit.sha !== baseSha ||
  references?.length !== 1 ||
  references[0]?.trim() !== `Refs #${workNumber}`
) {
  throw new Error(
    "Issuer probe candidate does not match the current Work and PR",
  );
}

const published = await publishGateCheck({
  repository: "Oxelio/architecture-web",
  repositoryToken: requiredEnvironment("PILOT_GATE_APP_TOKEN"),
  name: "Architecture Web / Work Merge Gate (issuer probe)",
  headSha,
  externalId: `work:${workNumber}:pr:${pullNumber}:${headSha}:${baseSha}`,
  title: "Dedicated check issuer probe",
  summary:
    "Verifies check attribution only. This check grants no integration eligibility.",
  pass: true,
  expectedAppId: appId,
});
writeJson({ workNumber, pullNumber, headSha, baseSha, appId, published });
