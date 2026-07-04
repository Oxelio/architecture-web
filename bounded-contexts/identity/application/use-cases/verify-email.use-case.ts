import type { UserPort } from "#application/ports/user.port";
import type { EmailVerificationPort } from "#application/ports/email-verification.port";
import { Result } from "@architecture/foundation";

export interface VerifyEmailInput {
  token: string;
}

export type VerifyEmailError =
  | { kind: "not_found" }
  | { kind: "token.invalid" }
  | { kind: "token.expired" };

export type VerifyEmailResult = Result<{}, VerifyEmailError>;

export class VerifyEmailUseCase {
  constructor(
    private readonly userPort: UserPort,
    private readonly emailVerification: EmailVerificationPort,
  ) {}

  async execute(command: VerifyEmailInput): Promise<VerifyEmailResult> {
    const record = await this.emailVerification.findByToken(command.token);
    if (!record) return Result.failure({ kind: "token.invalid" });

    if (record.used) return Result.failure({ kind: "token.invalid" });

    if (record.expiresAt.getTime() < Date.now()) {
      return Result.failure({ kind: "token.expired" });
    }

    const user = await this.userPort.findById(record.userId);
    if (!user) return Result.failure({ kind: "not_found" });

    user.verifyEmail();
    user.activate();
    await this.userPort.save(user);

    await this.emailVerification.markUsed(record.token);

    return Result.ok({});
  }
}
