import type { SecurityPolicy } from "#domain/security-policy";
export interface AccountPolicyReader {
  getAccountPolicy(): Promise<SecurityPolicy["accounts"]>;
}
