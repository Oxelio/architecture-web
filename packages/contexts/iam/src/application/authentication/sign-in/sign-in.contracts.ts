// @file bounded-contexts/iam/application/use-cases/sign-in/sign-in.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { SessionClient, SessionNetwork } from "#entities/session.entity";
export interface SecondFactorChallenge {
  readonly mfaRequired: true;
  readonly userId: string;
  readonly sessionId: null;
  readonly sessionExpiresAt: null;
  readonly challengeId: string;
  readonly expiresAt: Date;
}
import type { LoginIdentifierKind } from "#value-objects/login-identifier.value-object";

import type { SignInErrorCodes } from "./sign-in.codes.js";

export type SignInError =
  | ValueOf<typeof SignInErrorCodes>
  | { readonly code: "MFA_CHALLENGE_INVALID" | "MFA_ENROLLMENT_REQUIRED" };

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
