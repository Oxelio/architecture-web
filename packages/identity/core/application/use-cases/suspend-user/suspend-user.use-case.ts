// @file bounded-contexts/identity/application/use-cases/suspend-user/suspend-user.use-case.ts

import { Result } from "@architecture/foundation";

import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { SuspendUserErrorCodes } from "./suspend-user.codes.js";
import type {
  SuspendUser,
  SuspendUserInput,
  SuspendUserOutput,
} from "./suspend-user.contracts.js";

export class SuspendUserUseCase implements SuspendUser {
  constructor(
    private readonly userPort: UserRepository,
    private readonly sessionPort: SessionRepository,
  ) {}

  async execute(input: SuspendUserInput): Promise<SuspendUserOutput> {
    const userId = UserIdentifierValueObject.create(input.userId);
    if (!userId.success) {
      return Result.failure(SuspendUserErrorCodes.invalidId);
    }
    if (input.actorUserId === userId.value.value) {
      return Result.failure(SuspendUserErrorCodes.selfOperation);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(SuspendUserErrorCodes.notFound);
    }

    user.suspend();
    await this.userPort.save(user);
    await this.sessionPort.deleteAllForUser(user.identifier);

    return Result.success(undefined);
  }
}
