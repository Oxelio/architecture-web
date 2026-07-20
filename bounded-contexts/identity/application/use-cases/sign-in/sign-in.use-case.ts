// @file bounded-contexts/identity/application/use-cases/sign-in/sign-in.use-case.ts

import { Result } from "@architecture/foundation";

import type { SessionPort } from "#application/ports/session.port";
import type { UserPort } from "#application/ports/user.port";
import { SessionEntity } from "#entities/session.entity";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

import type { PasswordHasherPort } from "../../ports/password-hasher.port.js";
import { SignInErrorCodes, SignInSuccessCodes } from "./sign-in.codes.js";
import type {
  AuthenticationSession,
  SignInInput,
  SignInOutput,
} from "./sign-in.types.js";

export class SignInUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly password: PasswordHasherPort,
    private readonly session: SessionPort,
  ) {}

  async execute(payload: SignInInput): Promise<SignInOutput> {
    const email = EmailValueObject.create(payload.email);
    if (!email.success) {
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    const user = await this.user.findByEmail(email.value);
    if (!user) {
      await this.password.fakeVerify(); // Timing attack prevention

      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    const passwordVerified = await this.password.verify(
      password.value,
      user.password,
    );
    if (!passwordVerified) {
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    if (user.status.isSuspended()) {
      return Result.failure(SignInErrorCodes.userSuspended);
    }

    const sessionEntity = SessionEntity.createForUser({
      userId: user.identifier,
    });
    await this.session.create(sessionEntity);

    const data: AuthenticationSession = {
      userId: user.identifier.value,
      sessionId: sessionEntity.identifier.value,
      sessionExpiresAt: sessionEntity.expiresAt,
    };

    return Result.success({
      code: SignInSuccessCodes.authenticated.code,
      data,
    });
  }
}
