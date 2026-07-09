import type { UserPort } from "#application/ports/user.port";
import type { EmailVerificationPort } from "#application/ports/email-verification.port";
import { Result, type ErrorOf } from "@architecture/foundation";

export interface VerifyEmailInput {
  token: string;
}

const VerifyEmailErrors = {
  userNotFound: {
    kind: "user.not_found",
  },
  tokenInvalid: {
    kind: "token.invalid",
  },
  tokenExpired: {
    kind: "token.expired",
  },
} as const;

export type VerifyEmailError = ErrorOf<typeof VerifyEmailErrors>;

export type VerifyEmailResult = Result<void, VerifyEmailError>;

export class VerifyEmailUseCase {
  constructor(
    private readonly userPort: UserPort,
    private readonly emailVerification: EmailVerificationPort,
  ) {}

  async execute(command: VerifyEmailInput): Promise<VerifyEmailResult> {
    const record = await this.emailVerification.findByToken(command.token);
    if (!record) {
      return Result.failure(VerifyEmailErrors.tokenInvalid);
    }

    if (record.used) {
      return Result.failure(VerifyEmailErrors.tokenInvalid);
    }

    if (record.expiresAt.getTime() < Date.now()) {
      return Result.failure(VerifyEmailErrors.tokenExpired);
    }

    const user = await this.userPort.findById(record.userId);
    if (!user) {
      return Result.failure(VerifyEmailErrors.userNotFound);
    }

    user.verifyEmail();
    user.activate();
    await this.userPort.save(user);

    await this.emailVerification.markUsed(record.token);

    return Result.ok();
  }
}
