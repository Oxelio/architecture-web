import type { SecurityPolicy } from "#domain/security-policy";
export interface AccountPolicyReader {
  getAccountPolicy(): Promise<SecurityPolicy["accounts"]>;
}

export interface RegistrationPolicyReader {
  getRegistrationPolicy(): Promise<{
    accounts: SecurityPolicy["accounts"];
    password: import("#domain/password-policy").PasswordPolicy;
  }>;
}
export interface AccountSecurityPolicyReader {
  getAccountSecurityPolicy(): Promise<
    Pick<SecurityPolicy, "accounts" | "authentication">
  >;
}
