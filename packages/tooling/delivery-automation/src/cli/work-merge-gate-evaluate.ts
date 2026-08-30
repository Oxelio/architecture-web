import { resolveActivationContext } from "../config/activation-context.js";
import { evaluateWorkMergeGate } from "../control/work-merge-gate.js";
import { readWorkMergeGateLiveEvidence } from "../github/gate-live-evidence.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import {
  markdownValue,
  positiveInteger,
  readActivationManifest,
  recordedAssertion,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";

const checkName = "Architecture Web / Work Merge Gate";

function evidenceLine(
  label: string,
  assertion: {
    readonly satisfied: boolean;
    readonly evidenceRef: string | null;
  },
): string {
  return `| ${label} | ${assertion.satisfied ? "PASS" : "FAIL"} | ${markdownValue(assertion.evidenceRef)} |`;
}

async function main(): Promise<void> {
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const projectsToken = requiredEnvironment("ARCHITECTURE_WEB_PROJECTS_TOKEN");
  const workNumber = positiveInteger("WORK_NUMBER");

  const tasks = recordedAssertion({
    valueName: "REQUIRED_TASKS_ACCEPTABLE",
    evidenceRefName: "TASKS_EVIDENCE_REF",
  });
  const reviews = recordedAssertion({
    valueName: "APPLICABLE_REVIEWS_ACCEPTED",
    evidenceRefName: "REVIEWS_EVIDENCE_REF",
  });
  const validation = recordedAssertion({
    valueName: "VALIDATION_SUFFICIENT",
    evidenceRefName: "VALIDATION_EVIDENCE_REF",
  });
  const authority = recordedAssertion({
    valueName: "PRIOR_AUTHORITY_GATES_SATISFIED",
    evidenceRefName: "AUTHORITY_EVIDENCE_REF",
  });
  const workingDecisions = recordedAssertion({
    valueName: "WORKING_DECISIONS_RESOLVED",
    evidenceRefName: "WORKING_DECISIONS_EVIDENCE_REF",
  });
  const repositoryChecks = recordedAssertion({
    valueName: "REPOSITORY_CHECKS_SATISFIED",
    evidenceRefName: "REPOSITORY_CHECKS_EVIDENCE_REF",
  });

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
    throw new Error(
      `Delivery activation unavailable: ${activation.blockers.join(", ")}`,
    );
  }

  const live = await readWorkMergeGateLiveEvidence({
    repository,
    projectId: activation.project.id,
    projectsToken,
    repositoryToken,
    workNumber,
    activation: activation.activation,
  });
  if (live.status === "blocked") {
    throw new Error(
      `Work Merge Gate live evidence unavailable: ${live.reason}`,
    );
  }

  const result = evaluateWorkMergeGate({
    workIdentified: true,
    workState: live.workState,
    requiredTasksAcceptable: tasks.satisfied,
    dependenciesResolved: live.dependenciesResolved,
    applicableReviewsAccepted: reviews.satisfied,
    validationSufficient: validation.satisfied,
    priorAuthorityGatesSatisfied: authority.satisfied,
    workingDecisionsResolved: workingDecisions.satisfied,
    repositoryChecksSatisfied: repositoryChecks.satisfied,
    pullRequestMergeable: live.pullRequestMergeable,
    enforcement: "unavailable",
  });

  const summary = [
    `Work: #${workNumber}`,
    `Work Integration PR: #${live.target.pullRequestNumber}`,
    `Target: \`${live.target.headRef}@${live.target.headSha}\` -> \`${live.target.baseRef}\``,
    `Work State: \`${live.workState}\``,
    `Enforcement: \`${result.enforcement}\``,
    "",
    `Result: **${result.pass ? "PASS" : "FAIL"}**`,
    `Blockers: ${result.blockers.length > 0 ? result.blockers.map((blocker) => `\`${blocker}\``).join(", ") : "none"}`,
    "",
    "| Recorded evidence | Result | Reference |",
    "| --- | --- | --- |",
    evidenceLine("Required Tasks acceptable", tasks),
    evidenceLine("Applicable reviews accepted", reviews),
    evidenceLine("Validation sufficient", validation),
    evidenceLine("Prior authority gates satisfied", authority),
    evidenceLine("Working Decisions resolved", workingDecisions),
    evidenceLine("Repository checks satisfied", repositoryChecks),
    `| Dependencies resolved (live) | ${live.dependenciesResolved ? "PASS" : "FAIL"} | GitHub dependency relation |`,
    `| Pull Request mergeable (live) | ${live.pullRequestMergeable ? "PASS" : "FAIL"} | GitHub PR state |`,
    "",
    "This check records already-established evidence. It grants no merge authority and does not imply Work Done.",
  ].join("\n");

  writeJson({
    gate: "work-merge",
    check: {
      name: checkName,
      headSha: live.target.headSha,
      title: `Work Merge Gate: ${result.pass ? "PASS" : "FAIL"}`,
      summary,
      pass: result.pass,
    },
    result,
    context: {
      workNumber,
      target: live.target,
    },
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Work Merge Gate evaluation failed: ${message}\n`);
  process.exitCode = 1;
});
