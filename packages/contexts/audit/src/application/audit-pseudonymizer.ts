/** Audit owns when references are replaced; infrastructure supplies the mechanism. */
export interface AuditPseudonymizer {
  /** Stable lowercase SHA-256 hex of the unmodified UTF-8 identifier, matching IAM deletion facts. A different scheme is a coordinated contract change. */
  reference(subjectId: string): string;
}
