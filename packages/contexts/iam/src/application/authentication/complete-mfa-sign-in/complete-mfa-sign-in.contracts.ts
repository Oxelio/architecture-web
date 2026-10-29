import type { Result, ValueOf } from "@architecture/foundation";

import type { IssueSession } from "#authentication/issue-session";
import type { FactorVerificationError } from "#authentication/reauthentication.contracts";

export const CompleteMfaSignInErrors = {
  invalidChallenge: { code: "mfa.invalid_challenge" },
} as const;

export interface CompleteMfaSignInInput {
  challengeId: string;
  code: string;
  metadata?: Parameters<IssueSession["issue"]>[1];
}

export type CompleteMfaSignInError =
  ValueOf<typeof CompleteMfaSignInErrors> | FactorVerificationError;

export type CompleteMfaSignInOutput = Result<
  import("#authentication/sign-in/sign-in.contracts").AuthenticationSession,
  CompleteMfaSignInError
>;

export interface CompleteMfaSignIn {
  execute(input: CompleteMfaSignInInput): Promise<CompleteMfaSignInOutput>;
}
