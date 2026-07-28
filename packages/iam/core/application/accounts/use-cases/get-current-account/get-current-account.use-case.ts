// @file bounded-contexts/iam/application/use-cases/get-current-account/get-current-account.use-case.ts

import { Result } from "@architecture/foundation";

import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { GetCurrentAccountErrorCodes } from "./get-current-account.codes.js";
import type {
  CurrentAccount,
  GetCurrentAccount,
  GetCurrentAccountInput,
  GetCurrentAccountOutput,
} from "./get-current-account.contracts.js";

export class GetCurrentAccountUseCase implements GetCurrentAccount {
  constructor(private readonly user: UserRepository) {}

  public async execute(
    payload: GetCurrentAccountInput,
  ): Promise<GetCurrentAccountOutput> {
    const userIdentifier = UserIdentifierValueObject.create(
      payload.actorUserId,
    );
    if (!userIdentifier.success) {
      return Result.failure(GetCurrentAccountErrorCodes.invalidId);
    }

    const user = await this.user.findById(userIdentifier.value);
    if (!user) {
      return Result.failure(GetCurrentAccountErrorCodes.notFound);
    }

    const data: CurrentAccount = {
      userId: user.identifier.value,
      email: user.email.value,
      isEmailVerified: user.isEmailVerified,
      role: user.role.value,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return Result.success(data);
  }
}
