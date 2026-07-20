// @file bounded-contexts/identity/application/use-cases/sign-out/sign-out.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type {
  SignOutErrorCodes,
  SignOutSuccessCodes,
} from "./sign-out.codes.js";

export interface SignOutInput {
  sessionId: string;
}

export type SignOutSuccess = ValueOf<typeof SignOutSuccessCodes>;

export type SignOutError = ValueOf<typeof SignOutErrorCodes>;

export type SignOutOutput = Result<SignOutSuccess, SignOutError>;
