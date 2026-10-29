import type { Result, ValueOf } from "@architecture/foundation";

import type { SecurityContext } from "#accounts/security-effects";

export const RequestPasswordRecoveryErrors = {
  invalidFormat: { code: "email.invalid_format" },
} as const;

export interface RequestPasswordRecoveryInput {
  email: string;
  context: SecurityContext;
}

export type RequestPasswordRecoveryError = ValueOf<
  typeof RequestPasswordRecoveryErrors
>;

export type RequestPasswordRecoveryOutput = Result<
  void,
  RequestPasswordRecoveryError
>;

export interface RequestPasswordRecovery {
  execute(
    input: RequestPasswordRecoveryInput,
  ): Promise<RequestPasswordRecoveryOutput>;
}
