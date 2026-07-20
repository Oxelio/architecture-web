// @file bounded-contexts/identity/application/use-cases/sign-in/sign-in.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { SignInErrorCodes, SignInSuccessCodes } from "./sign-in.codes.js";

export interface SignInInput {
  email: string;
  password: string;
}

export type SignInSuccess = ValueOf<typeof SignInSuccessCodes>;

export type SignInError = ValueOf<typeof SignInErrorCodes>;

export interface AuthenticationSession {
  userId: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

export type SignInOutput = Result<
  {
    code: SignInSuccess["code"];
    data: AuthenticationSession;
  },
  SignInError
>;
