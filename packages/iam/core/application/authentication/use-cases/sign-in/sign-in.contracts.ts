// @file bounded-contexts/iam/application/use-cases/sign-in/sign-in.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { SessionClient, SessionNetwork } from "#entities/session.entity";
import type { SecondFactorChallenge } from "#services/second-factor-gate.service";

import type { SignInErrorCodes } from "./sign-in.codes.js";

export type SignInError = ValueOf<typeof SignInErrorCodes>;

export interface SignInInput {
  email: string;
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
