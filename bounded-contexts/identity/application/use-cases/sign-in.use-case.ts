import type { PasswordHasherPort } from "../ports/password-hasher.port.js";
import { Result, type ErrorOf } from "@architecture/foundation";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { SessionEntity } from "#entities/session.entity";
import type { SessionPort } from "#application/ports/session.port";
import type { UserPort } from "#application/ports/user.port";

export interface SignInInput {
  email: string;
  password: string;
}

const SignInErrors = {
  invalidCredentials: {
    kind: "user.invalid_credentials",
  },

  userSuspended: {
    kind: "user.suspended",
  },
} as const;

export type SignInError = ErrorOf<typeof SignInErrors>;

export interface SignInResponse {
  userId: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

export type SignInResult = Result<SignInResponse, SignInError>;

export class SignInUseCase {
  constructor(
    private readonly user: UserPort,
    private readonly password: PasswordHasherPort,
    private readonly session: SessionPort,
  ) {}

  async execute(payload: SignInInput): Promise<SignInResult> {
    const email = EmailValueObject.create(payload.email);
    if (!email.success) {
      return Result.failure(SignInErrors.invalidCredentials);
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(SignInErrors.invalidCredentials);
    }

    const user = await this.user.findByEmail(email.value);
    if (!user) {
      await this.password.fakeVerify(); // Timing attack prevention

      return Result.failure(SignInErrors.invalidCredentials);
    }

    const passwordVerified = await this.password.verify(
      password.value,
      user.password,
    );
    if (!passwordVerified) {
      return Result.failure(SignInErrors.invalidCredentials);
    }

    if (user.status.isSuspended()) {
      return Result.failure(SignInErrors.userSuspended);
    }

    const sessionEntity = SessionEntity.createForUser({
      userId: user.identifier,
    });
    await this.session.create(sessionEntity);

    return Result.ok({
      userId: user.identifier.value,
      sessionId: sessionEntity.identifier.value,
      sessionExpiresAt: sessionEntity.expiresAt,
    });
  }
}
