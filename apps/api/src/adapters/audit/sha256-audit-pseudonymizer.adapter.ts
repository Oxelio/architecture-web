import { createHash } from "node:crypto";

import type { AuditPseudonymizer } from "@architecture/audit/application";

export class Sha256AuditPseudonymizerAdapter implements AuditPseudonymizer {
  reference(subjectId: string): string {
    return createHash("sha256").update(subjectId).digest("hex");
  }
}
