import type { SecurityPolicy } from "#domain/security-policy";
export interface RecoveryPolicyReader {
  getRecoveryPolicy(): Promise<SecurityPolicy["recovery"]>;
}
