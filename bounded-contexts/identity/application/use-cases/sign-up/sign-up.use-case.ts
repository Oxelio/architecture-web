// @file bounded-contexts/identity/application/use-cases/sign-up/sign-up.use-case.ts

import { Result } from "@architecture/foundation";
import { v4 as uuidv4 } from "uuid";

import { UserEntity } from "#entities/user.entity";
import type { EmailSenderPort } from "#ports/email-sender.port";
import type { EmailVerificationPort } from "#ports/email-verification.port";
import type { PasswordHasherPort } from "#ports/password-hasher.port";
import type { UserPort } from "#ports/user.port";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

import { SignUpErrorCodes, SignUpSuccessCodes } from "./sign-up.codes.js";
import type {
  SignUpInput,
  SignUpOutput,
  UserRegistration,
} from "./sign-up.types.js";

export class SignUpUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly password: PasswordHasherPort,
    private readonly emailVerification: EmailVerificationPort,
    private readonly emailSender: EmailSenderPort,
  ) {}

  async execute(payload: SignUpInput): Promise<SignUpOutput> {
    const email = EmailValueObject.create(payload.email);
    if (!email.success) {
      return Result.failure(email.error);
    }

    const existingUser = await this.user.findByEmail(email.value);
    if (existingUser) {
      return Result.failure(SignUpErrorCodes.userAlreadyExists);
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

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    await this.emailVerification.create(user.identifier, token, expiresAt);
    await this.emailSender.sendVerificationEmail(email.value, token);

    const data: UserRegistration = {
      userId: user.identifier.value,
    };

    return Result.success({
      code: SignUpSuccessCodes.created.code,
      data,
    });
  }
}
