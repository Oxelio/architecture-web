import { sameWorkIntegrationCandidate } from "../control/work-integration-request.js";
import { executeReservedGitHubWorkIntegration } from "./reserved-work-integration.js";
import { verifyStandingWorkEligibility } from "./standing-work-eligibility.js";
import { readAcceptedStandingImpact } from "./work-merge-publisher.js";

type ReservedInput = Parameters<typeof executeReservedGitHubWorkIntegration>[0];
type EligibilityInput = Parameters<typeof verifyStandingWorkEligibility>[0];

export async function executeEligibleStandingWorkIntegration(
  input: ReservedInput & {
    readonly eligibilityReader: EligibilityInput["reader"];
  },
): ReturnType<typeof executeReservedGitHubWorkIntegration> {
  const { eligibilityReader: reader, scope, candidate } = input;
  const { publisher } = scope;
  if (input.standingEnabled !== true && input.operation !== "resolve") {
    return { status: "inactive" };
  }
  if (
    reader.repository.toLowerCase() !== publisher.repository.toLowerCase() ||
    reader.projectId !== publisher.projectId ||
    reader.projectsToken !== publisher.projectsToken ||
    reader.repositoryToken !== publisher.repositoryToken
  ) {
    return { status: "denied" };
  }

  return executeReservedGitHubWorkIntegration({
    ...input,
    authorize: async (request) => {
      if (
        !sameWorkIntegrationCandidate(candidate, request.candidate) ||
        !(await input.authorize(request))
      ) {
        return false;
      }
      // Recovery remains possible after eligibility has been revoked.
      return (
        request.operation === "resolve" ||
        (await verifyStandingWorkEligibility({
          reader,
          candidate,
          readAcceptedImpact: (current) =>
            readAcceptedStandingImpact(publisher, current),
        }))
      );
    },
  });
}
