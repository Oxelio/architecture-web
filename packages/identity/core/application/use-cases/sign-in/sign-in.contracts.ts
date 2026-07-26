// @file bounded-contexts/identity/application/use-cases/sign-in/sign-in.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { SignInErrorCodes } from "./sign-in.codes.js";

export type SignInError = ValueOf<typeof SignInErrorCodes>;

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthenticationSession {
  userId: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

export type SignInOutput = Result<AuthenticationSession, SignInError>;

export interface SignIn {
  execute(command: SignInInput): Promise<SignInOutput>;
}
