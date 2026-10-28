import type { SecurityPolicy } from "#domain/security-policy";
export interface AuthenticationPolicyReader {
  getAuthenticationPolicy(): Promise<SecurityPolicy["authentication"]>;
}
export interface SessionPolicyReader {
  getSessionPolicy(): Promise<SecurityPolicy["sessions"]>;
}

export interface SignInPolicyReader {
  getSignInPolicy(): Promise<
    Pick<SecurityPolicy, "accounts" | "authentication" | "sessions">
  >;
}
