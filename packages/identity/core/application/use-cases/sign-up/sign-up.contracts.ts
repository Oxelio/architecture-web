// @file bounded-contexts/identity/application/use-cases/sign-up/sign-up.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { PasswordValidationError } from "#services/password-policy-validator.service";
import type { EmailError } from "#value-objects/email.value-object";
import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

import type { SignUpErrorCodes } from "./sign-up.codes.js";

export type SignUpError =
  | EmailError
  | PlainPasswordError
  | PasswordValidationError
  | ValueOf<typeof SignUpErrorCodes>;

export interface SignUpInput {
  email: string;
  password: string;
  passwordConfirmation: string;
}

export interface UserRegistration {
  userId: string;
}

export type SignUpOutput = Result<UserRegistration, SignUpError>;

export interface SignUp {
  execute(command: SignUpInput): Promise<SignUpOutput>;
}
