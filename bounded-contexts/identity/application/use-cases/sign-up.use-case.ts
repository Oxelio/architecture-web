// bounded-contexts/identity/application/features/register-user/register-user.use-case.ts

import type { PasswordHasherPort } from "#ports/password-hasher.port";
import type { UserPort } from "#ports/user.port";
import type { EmailSenderPort } from "#ports/email-sender.port";
import type { EmailVerificationPort } from "#ports/email-verification.port";
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
    private readonly emailVerification: EmailVerificationPort,
    private readonly emailSender: EmailSenderPort,
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

    // persist user as pending (not verified)
    await this.user.save(user);

    // generate token, store and send verification email
    const { v4: uuidv4 } = await import("uuid");
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    await this.emailVerification.create(user.identifier, token, expiresAt);
    await this.emailSender.sendVerificationEmail(email.value, token);

    return Result.ok({
      userId: user.identifier.value,
    });
  }
}
