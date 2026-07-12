import { Result, type ErrorOf } from "@architecture/foundation";
import type { SessionPort } from "#application/ports/session.port";
import type { UserPort } from "#application/ports/user.port";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

export interface ResolveSessionInput {
  sessionId: string;
}

const ResolveSessionErrors = {
  unauthorized: {
    code: "session.unauthorized",
  },
} as const;

export type ResolveSessionError = ErrorOf<typeof ResolveSessionErrors>;

export interface ResolveSessionResponse {
  userId: string;
  sessionId: string;
}

export type ResolveSessionResult = Result<
  ResolveSessionResponse,
  ResolveSessionError
>;

export class ResolveSessionUseCase {
  constructor(
    private readonly sessionPort: SessionPort,
    private readonly userPort: UserPort,
  ) {}

  async execute(payload: ResolveSessionInput): Promise<ResolveSessionResult> {
    if (!payload.sessionId) {
      return Result.failure(ResolveSessionErrors.unauthorized);
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);
    if (!sessionId.success) {
      return Result.failure(ResolveSessionErrors.unauthorized);
    }

    const session = await this.sessionPort.findById(sessionId.value);
    if (!session || session.isExpired()) {
      return Result.failure(ResolveSessionErrors.unauthorized);
    }

    const user = await this.userPort.findById(session.userId);

    if (!user) {
      return Result.failure(ResolveSessionErrors.unauthorized);
    }

    return Result.ok({
      userId: user.identifier.value,
      sessionId: session.identifier.value,
    });
  }
}
