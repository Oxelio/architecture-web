// @file bounded-contexts/identity/application/use-cases/activate-user.use-case.ts

import type { UserPort } from "#application/ports/user.port";
import { Result, type ErrorOf } from "@architecture/foundation";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface ActivateUserCommand {
  readonly userId: string;
}

const ActivateUserErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export type ActivateUserError = ErrorOf<typeof ActivateUserErrors>;

export type ActivateUserResult = Result<void, ActivateUserError>;

export class ActivateUserUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: ActivateUserCommand): Promise<ActivateUserResult> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(ActivateUserErrors.invalidId);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ActivateUserErrors.notFound);
    }

    user.activate();
    await this.userPort.save(user);

    return Result.ok();
  }
}
