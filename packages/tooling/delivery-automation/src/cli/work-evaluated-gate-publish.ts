import {
  type WorkMergeGateResult,
  workMergeRequiredCheckName,
} from "../control/work-merge-gate.js";
import { publishGateCheck } from "../github/gate-check-publisher.js";
import type { MergeCandidate } from "../github/work-merge-publisher.js";
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
  throw new Error("The evaluated Gate requires the authenticated maintainer");
}

const workNumber = positiveInteger("PILOT_WORK_NUMBER");
const pullNumber = positiveInteger("PILOT_PULL_NUMBER");
const headSha = requiredEnvironment("PILOT_HEAD_SHA");
const baseSha = requiredEnvironment("PILOT_BASE_SHA");
const appId = positiveInteger("PILOT_GATE_APP_ID");
if (
  appId !== 5625775 ||
  positiveInteger("PILOT_GATE_INSTALLATION_ID") !== 178883123
) {
  throw new Error(
    "The evaluated Gate requires the verified GitHub App installation",
  );
}
const evaluated = JSON.parse(
  Buffer.from(requiredEnvironment("GATE_RESULT_B64"), "base64").toString(
    "utf8",
  ),
) as {
  readonly candidate: MergeCandidate;
  readonly result: WorkMergeGateResult;
  readonly expiresAt: string;
};
const { candidate, result } = evaluated;
if (
  workNumber !== 96 ||
  pullNumber !== 98 ||
  candidate.workNumber !== workNumber ||
  candidate.pullNumber !== pullNumber ||
  candidate.headSha !== headSha ||
  candidate.baseSha !== baseSha ||
  baseSha !== requiredEnvironment("TRUSTED_WORKFLOW_SHA") ||
  !(Date.parse(evaluated.expiresAt) > Date.now()) ||
  !/^[0-9a-f]{40}$/u.test(headSha) ||
  !/^[0-9a-f]{40}$/u.test(baseSha) ||
  typeof result.pass !== "boolean" ||
  !Array.isArray(result.blockers) ||
  result.pass !== (result.blockers.length === 0) ||
  result.grantsMergeAuthority !== false ||
  result.impliesDone !== false
) {
  throw new Error(
    "Evaluated Gate output does not match the authorized candidate",
  );
}
const [pr, main] = await Promise.all([
  githubRepositoryRequest<{
    readonly number: number;
    readonly state: string;
    readonly draft: boolean;
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
  pr.draft !== false ||
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
    "Evaluated Gate candidate does not match the current Work and PR",
  );
}

const externalId = `work:${workNumber}:pr:${pullNumber}:${headSha}:${baseSha}`;
const checks = await githubRepositoryRequest<{
  readonly total_count: number;
  readonly check_runs: readonly {
    readonly app?: { readonly id?: number };
    readonly external_id?: string;
  }[];
}>(
  `/commits/${headSha}/check-runs?check_name=${encodeURIComponent(workMergeRequiredCheckName)}&filter=all&per_page=100`,
);
if (
  !Array.isArray(checks.check_runs) ||
  checks.total_count !== checks.check_runs.length
) {
  throw new Error("Evaluated Gate check inventory incomplete");
}
if (
  checks.check_runs.some(
    (check) => check.app?.id === appId && check.external_id === externalId,
  )
) {
  throw new Error(
    "The evaluated Gate has already been published for this candidate",
  );
}
const published = await publishGateCheck({
  repository: "Oxelio/architecture-web",
  repositoryToken: requiredEnvironment("PILOT_GATE_APP_TOKEN"),
  name: workMergeRequiredCheckName,
  headSha,
  externalId,
  title: `Work Merge Gate: ${result.pass ? "PASS" : "FAIL"}`,
  summary: [
    `Work #${workNumber} / PR #${pullNumber}`,
    `Head: ${headSha}`,
    `Base: ${baseSha}`,
    `Blockers: ${result.blockers.join(", ") || "none"}`,
    "This check records evaluated evidence and grants no merge authority.",
  ].join("\n"),
  pass: result.pass,
  expectedAppId: appId,
});
writeJson({ candidate, result, appId, published });
