import type { UserPort } from "#application/ports/user.port";
import { Result } from "@architecture/foundation";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface SuspendUserInput {
  userId: string;
}

export type SuspendUserError = { kind: "not_found" };

export type SuspendUserResult = Result<{}, SuspendUserError>;

export class SuspendUserUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: SuspendUserInput): Promise<SuspendUserResult> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) return Result.failure({ kind: "not_found" });

    const user = await this.userPort.findById(userId.value);
    if (!user) return Result.failure({ kind: "not_found" });

    user.suspend();
    await this.userPort.save(user);

    return Result.ok({});
  }
}
