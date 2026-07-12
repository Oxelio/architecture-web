import type { UserPort } from "#application/ports/user.port";
import { Result } from "@architecture/foundation";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface SuspendUserInput {
  userId: string;
}

export interface SuspendUserError {
  code: "not_found";
}

export type SuspendUserResult = Result<void, SuspendUserError>;

export class SuspendUserUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: SuspendUserInput): Promise<SuspendUserResult> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure({ code: "not_found" });
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure({ code: "not_found" });
    }

    user.suspend();
    await this.userPort.save(user);

    return Result.ok();
  }
}
