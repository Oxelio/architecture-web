// @file bounded-contexts/identity/application/use-cases/sign-in/sign-in.use-case.ts

import { Result } from "@architecture/foundation";

import { SessionEntity } from "#entities/session.entity";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { PasswordHasher } from "#services/password-hasher.service";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

import { SignInErrorCodes } from "./sign-in.codes.js";
import type {
  AuthenticationSession,
  SignIn,
  SignInInput,
  SignInOutput,
} from "./sign-in.contracts.js";

export class SignInUseCase implements SignIn {
  constructor(
    private readonly user: UserRepository,
    private readonly password: PasswordHasher,
    private readonly session: SessionRepository,
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
      ...(payload.client ? { client: payload.client } : {}),
      ...(payload.network ? { network: payload.network } : {}),
    });
    await this.session.save(sessionEntity);

    const data: AuthenticationSession = {
      userId: user.identifier.value,
      sessionId: sessionEntity.identifier.value,
      sessionExpiresAt: sessionEntity.expiresAt,
    };

    return Result.success(data);
  }
}
