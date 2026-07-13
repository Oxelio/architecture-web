import type { UserPort } from "#application/ports/user.port";
import { Result, type ErrorOf } from "@architecture/foundation";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface SuspendUserInput {
  userId: string;
}

const SuspendUserErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export type SuspendUserError = ErrorOf<typeof SuspendUserErrors>;

export type SuspendUserResult = Result<void, SuspendUserError>;

export class SuspendUserUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: SuspendUserInput): Promise<SuspendUserResult> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(SuspendUserErrors.invalidId);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(SuspendUserErrors.notFound);
    }

    user.suspend();
    await this.userPort.save(user);

    return Result.ok();
  }
}
