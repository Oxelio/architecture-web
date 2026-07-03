// bounded-contexts/identity/application/features/register-user/register-user.use-case.ts

import type { PasswordHasherPort } from "#ports/password-hasher.port";
import type { UserPort } from "#ports/user.port";
import { UserEntity } from "#entities/user.entity";
import { Result } from "@architecture/foundation";
import {
  EmailValueObject,
  type EmailError,
} from "#value-objects/email.value-object";
import {
  PasswordPlainValueObject,
  type PlainPasswordError,
} from "#value-objects/password-plain.value-object";

export interface SignUpInput {
  email: string;
  password: string;
}

export type SignUpError =
  | EmailError
  | PlainPasswordError
  | {
      kind: "user.already_exists";
    };

export interface SignUpResponse {
  userId: string;
}

export type SignUpResult = Result<SignUpResponse, SignUpError>;

export class SignUpUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly password: PasswordHasherPort,
  ) {}

  async execute(payload: SignUpInput): Promise<SignUpResult> {
    const email = EmailValueObject.create(payload.email);
    if (!email.success) {
      return Result.failure(email.error);
    }

    const existingUser = await this.user.findByEmail(email.value);
    if (existingUser) {
      return Result.failure({
        kind: "user.already_exists",
      });
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(password.error);
    }

    const hashedPassword = await this.password.hash(password.value);

    const user = UserEntity.create({
      email: email.value,
      password: hashedPassword,
    });
    await this.user.save(user);

    return Result.ok({
      userId: user.identifier.value,
    });
  }
}
