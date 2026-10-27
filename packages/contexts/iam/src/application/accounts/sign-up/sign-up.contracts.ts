// @file bounded-contexts/iam/application/use-cases/sign-up/sign-up.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { PasswordValidationError } from "#accounts/password-policy/password-validation";
import type {
  LoginIdentifierError,
  LoginIdentifierKind,
} from "#value-objects/login-identifier.value-object";
import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

import type { SignUpErrorCodes } from "./sign-up.codes.js";

export type SignUpError =
  | LoginIdentifierError
  | PlainPasswordError
  | PasswordValidationError
  | ValueOf<typeof SignUpErrorCodes>;

export interface SignUpInput {
  login: {
    kind: LoginIdentifierKind;
    value: string;
  };
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
