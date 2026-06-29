// bounded-contexts/identity/application/features/register-user/register-user.result.ts

import type { EmailError } from "#value-objects/email.value-object";
import type { PlainPasswordError } from "#value-objects/password-plain.value-object";
import type { Result } from "@architecture/foundation";

export type RegisterError =
  | EmailError
  | PlainPasswordError
  | {
      kind: "user.already_exists";
    };

export interface RegisterUserResponse {
  userId: string;
}

export type RegisterResult = Result<RegisterUserResponse, RegisterError>;
