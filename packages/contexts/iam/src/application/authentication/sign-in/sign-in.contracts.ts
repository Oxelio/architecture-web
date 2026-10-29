import type { Result, ValueOf } from "@architecture/foundation";

import type { BeginSecondFactorError } from "#authentication/begin-second-factor/begin-second-factor.contracts";
import type { SessionClient, SessionNetwork } from "#entities/session.entity";
import type { LoginIdentifierKind } from "#value-objects/login-identifier.value-object";

export const SignInErrors = {
  invalidCredentials: {
    code: "authentication.invalid_credentials",
  },

  userSuspended: {
    code: "user.suspended",
  },
} as const;

export interface SecondFactorChallenge {
  readonly mfaRequired: true;
  readonly userId: string;
  readonly sessionId: null;
  readonly sessionExpiresAt: null;
  readonly challengeId: string;
  readonly expiresAt: Date;
}

export type SignInError = ValueOf<typeof SignInErrors> | BeginSecondFactorError;

export interface SignInInput {
  login: {
    kind: LoginIdentifierKind;
    value: string;
  };
  password: string;
  client?: SessionClient;
  network?: SessionNetwork;
}

export interface AuthenticationSession {
  userId: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

export type SignInOutput = Result<
  AuthenticationSession | SecondFactorChallenge,
  SignInError
>;

export interface SignIn {
  execute(command: SignInInput): Promise<SignInOutput>;
}
