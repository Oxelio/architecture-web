import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import { createPublicAuthoringReceiptReader } from "../github/github-work-reservation-journal.js";
import type { PrivateAuthoringResult } from "./sealed-authoring-store.js";

// Only a terminal receipt already committed by the protected journal writer
// can recover a lost callback. The public repository read takes no credential
// and never dispatches or settles an operation.
export function createAuthoringTerminalResultReader(input: {
  readonly maximumHistoryRevisions: number;
  readonly readReceipt?: ReturnType<typeof createPublicAuthoringReceiptReader>;
}) {
  const readReceipt = input.readReceipt ?? createPublicAuthoringReceiptReader();
  return async (
    request: PreparedAuthoringRequest,
  ): Promise<PrivateAuthoringResult | null> => {
    try {
      const receipt = await readReceipt(
        request.requestId,
        input.maximumHistoryRevisions,
      );
      if (
        !receipt ||
        receipt.outcome === "admitted" ||
        receipt.intent.requestId !== request.requestId ||
        receipt.intent.actorDigest !== request.actorDigest ||
        receipt.intent.commandDigest !== request.commandDigest
      ) {
        return null;
      }
      return {
        status:
          receipt.outcome === "known-unstarted" ? "denied" : receipt.outcome,
        canonicalUrls: [],
      };
    } catch {
      return null;
    }
  };
}
