import type { ValueOf } from "@architecture/foundation";

export const FactorVerificationErrors = {
  notEnabled: { code: "mfa.not_enabled" },
  invalidChallenge: { code: "mfa.invalid_challenge" },
  invalidCode: { code: "mfa.invalid_code" },
} as const;

export const ReauthenticationErrors = {
  invalidCredentials: { code: "authentication.invalid_credentials" },
  recentProofRequired: { code: "authentication.recent_proof_required" },
  codeRequired: { code: "mfa.code_required" },
} as const;

export type FactorVerificationError = ValueOf<typeof FactorVerificationErrors>;
export type PasswordAuthenticationError =
  typeof ReauthenticationErrors.invalidCredentials;
export type RecentAuthenticationError =
  | PasswordAuthenticationError
  | typeof ReauthenticationErrors.recentProofRequired;
export type StrongAuthenticationError =
  | RecentAuthenticationError
  | FactorVerificationError
  | typeof ReauthenticationErrors.codeRequired;
