import type { Result, ValueOf } from "@architecture/foundation";

import type { RecentAuthenticationError } from "#authentication/reauthentication.contracts";
import type { FactorVerificationError } from "#authentication/reauthentication.contracts";

export const DisableMfaErrors = {
  notFound: { code: "user.not_found" },
  requiredByPolicy: { code: "mfa.required_by_policy" },
  concurrentModification: { code: "account.concurrent_modification" },
} as const;

export interface DisableMfaInput {
  userId: string;
  sessionId: string;
  password: string;
  code: string;
}

export type DisableMfaError =
  | ValueOf<typeof DisableMfaErrors>
  | RecentAuthenticationError
  | FactorVerificationError;

export type DisableMfaOutput = Result<void, DisableMfaError>;

export interface DisableMfa {
  execute(input: DisableMfaInput): Promise<DisableMfaOutput>;
}
