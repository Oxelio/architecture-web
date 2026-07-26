// @file bounded-contexts/identity/application/use-cases/sign-out/sign-out.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { SignOutErrorCodes } from "./sign-out.codes.js";

export interface SignOutInput {
  sessionId: string;
}

export type SignOutError = ValueOf<typeof SignOutErrorCodes>;

export type SignOutOutput = Result<undefined, SignOutError>;

export interface SignOut {
  execute(command: SignOutInput): Promise<SignOutOutput>;
}
