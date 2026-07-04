import type { UserPort } from "#application/ports/user.port";
import { Result } from "@architecture/foundation";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface ActivateUserInput {
  userId: string;
}

export type ActivateUserError = { kind: "not_found" };

export type ActivateUserResult = Result<{}, ActivateUserError>;

export class ActivateUserUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: ActivateUserInput): Promise<ActivateUserResult> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) return Result.failure({ kind: "not_found" });

    const user = await this.userPort.findById(userId.value);
    if (!user) return Result.failure({ kind: "not_found" });

    user.activate();
    await this.userPort.save(user);

    return Result.ok({});
  }
}
