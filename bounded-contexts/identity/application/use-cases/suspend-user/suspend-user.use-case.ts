// @file bounded-contexts/identity/application/use-cases/suspend-user/suspend-user.use-case.ts

import { Result } from "@architecture/foundation";

import type { UserPort } from "#application/ports/user.port";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  SuspendUserErrorCodes,
  SuspendUserSuccessCodes,
} from "./suspend-user.codes.js";
import type {
  SuspendUserInput,
  SuspendUserOutput,
} from "./suspend-user.types.js";

export class SuspendUserUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: SuspendUserInput): Promise<SuspendUserOutput> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(SuspendUserErrorCodes.invalidId);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(SuspendUserErrorCodes.notFound);
    }

    user.suspend();
    await this.userPort.save(user);

    return Result.success(SuspendUserSuccessCodes.suspended);
  }
}
