import { evaluateReleasePromotionGate } from "../control/release-promotion-gate.js";
import { readReleasePromotionTarget } from "../github/gate-live-evidence.js";
import { readHumanReleaseApproval } from "../github/release-approval-record.js";
import {
  markdownValue,
  optionalEnvironment,
  positiveInteger,
  recordedAssertion,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";

const checkName = "Architecture Web / Release Promotion Gate";

function evidenceLine(
  label: string,
  assertion: { readonly satisfied: boolean; readonly evidenceRef: string | null },
): string {
  return `| ${label} | ${assertion.satisfied ? "PASS" : "FAIL"} | ${markdownValue(assertion.evidenceRef)} |`;
}

async function main(): Promise<void> {
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const releaseWorkNumber = positiveInteger("RELEASE_WORK_NUMBER");
  const artifactIdentity = optionalEnvironment("CANDIDATE_ARTIFACT_IDENTITY");

  const betaEvidence = recordedAssertion({
    valueName: "BETA_EVIDENCE_SUFFICIENT",
    evidenceRefName: "BETA_EVIDENCE_REF",
  });
  const repositoryChecks = recordedAssertion({
    valueName: "REPOSITORY_CHECKS_SATISFIED",
    evidenceRefName: "REPOSITORY_CHECKS_EVIDENCE_REF",
  });
  const releaseBlockers = recordedAssertion({
    valueName: "RELEASE_BLOCKERS_RESOLVED",
    evidenceRefName: "RELEASE_BLOCKERS_EVIDENCE_REF",
  });
  const workingDecisions = recordedAssertion({
    valueName: "WORKING_DECISIONS_RESOLVED",
    evidenceRefName: "WORKING_DECISIONS_EVIDENCE_REF",
  });

  const target = await readReleasePromotionTarget({
    repository,
    releaseWorkNumber,
    repositoryToken,
    artifactIdentity,
  });
  if (target.status !== "selected") {
    throw new Error(
      target.status === "ambiguous"
        ? `Release promotion PR is ambiguous: ${target.pullRequestNumbers.join(", ")}`
        : "Release promotion PR is unavailable",
    );
  }

  const approval = await readHumanReleaseApproval({
    repository,
    releaseWorkNumber,
    repositoryToken,
  });
  if (approval.status === "unavailable") {
    throw new Error(approval.diagnostic);
  }

  const result = evaluateReleasePromotionGate({
    releaseWorkIdentified: true,
    candidate: target.target.candidate,
    betaEvidenceSufficient: betaEvidence.satisfied,
    humanReleaseApproval: approval.evidence,
    repositoryChecksSatisfied: repositoryChecks.satisfied,
    releaseBlockersResolved: releaseBlockers.satisfied,
    workingDecisionsResolved: workingDecisions.satisfied,
    enforcement: "unavailable",
  });

  const approvalReference = approval.record?.url ?? approval.diagnostic;
  const summary = [
    `Release Work: #${releaseWorkNumber}`,
    `Promotion PR: #${target.target.pullRequestNumber}`,
    `Candidate: \`${target.target.candidate.sourceRef}@${target.target.candidate.sourceSha}\``,
    `Artifact identity: ${markdownValue(target.target.candidate.artifactIdentity)}`,
    `Enforcement: \`${result.enforcement}\``,
    "",
    `Result: **${result.pass ? "PASS" : "FAIL"}**`,
    `Blockers: ${result.blockers.length > 0 ? result.blockers.map((blocker) => `\`${blocker}\``).join(", ") : "none"}`,
    "",
    "| Recorded evidence | Result | Reference |",
    "| --- | --- | --- |",
    evidenceLine("Beta evidence sufficient", betaEvidence),
    `| Human Release Approval | ${approval.evidence.exists ? "PASS" : "FAIL"} | ${markdownValue(approvalReference)} |`,
    evidenceLine("Repository checks satisfied", repositoryChecks),
    evidenceLine("Release blockers resolved", releaseBlockers),
    evidenceLine("Working Decisions resolved", workingDecisions),
    "",
    "Human Release Approval is read from the latest marked Release Work comment and is valid only for a human GitHub user with maintain/admin permission and the exact candidate identity.",
    "This check does not execute Human Release Approval and grants no automatic merge or deployment authority.",
  ].join("\n");

  writeJson({
    gate: "release-promotion",
    check: {
      name: checkName,
      headSha: target.target.candidate.sourceSha,
      title: `Release Promotion Gate: ${result.pass ? "PASS" : "FAIL"}`,
      summary,
      pass: result.pass,
    },
    result,
    context: {
      releaseWorkNumber,
      target: target.target,
      approval: {
        record: approval.record,
        diagnostic: approval.diagnostic,
      },
    },
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Release Promotion Gate evaluation failed: ${message}\n`);
  process.exitCode = 1;
});
