// @file bounded-contexts/identity/application/use-cases/sign-up/sign-up.types.ts
import type { ApplicationResult, ValueOf } from "@architecture/foundation";

import type { EmailError } from "#value-objects/email.value-object";
import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

import type { SignUpErrorCodes, SignUpSuccessCodes } from "./sign-up.codes.js";

export interface SignUpInput {
  email: string;
  password: string;
}

export type SignUpSuccess = ValueOf<typeof SignUpSuccessCodes>;

export type SignUpError =
  EmailError | PlainPasswordError | ValueOf<typeof SignUpErrorCodes>;

export interface UserRegistration {
  userId: string;
}

export type SignUpOutput = ApplicationResult<
  SignUpSuccess["code"],
  UserRegistration,
  SignUpError
>;
