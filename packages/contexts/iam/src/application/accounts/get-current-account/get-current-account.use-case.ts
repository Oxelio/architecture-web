import { Result } from "@architecture/foundation";

import type { UserQueryRepository } from "#ports/user-query.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  CurrentAccount,
  GetCurrentAccount,
  GetCurrentAccountInput,
  GetCurrentAccountOutput,
} from "./get-current-account.contracts.js";
import { GetCurrentAccountErrors } from "./get-current-account.contracts.js";

export class GetCurrentAccountUseCase implements GetCurrentAccount {
  constructor(private readonly user: UserQueryRepository) {}

  public async execute(
    payload: GetCurrentAccountInput,
  ): Promise<GetCurrentAccountOutput> {
    const userIdentifier = UserIdentifierValueObject.create(
      payload.actorUserId,
    );
    if (!userIdentifier.success) {
      return Result.failure(GetCurrentAccountErrors.invalidId);
    }

    const user = await this.user.findAccountById(userIdentifier.value.value);
    if (!user) {
      return Result.failure(GetCurrentAccountErrors.notFound);
    }

    const data: CurrentAccount = {
      userId: user.userId,
      loginIdentifiers: user.identifiers,
      email:
        user.identifiers.find((identifier) => identifier.kind === "email")
          ?.value ?? null,
      isEmailVerified:
        user.identifiers.find((identifier) => identifier.kind === "email")
          ?.verificationStatus === "verified",
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return Result.success(data);
  }
}
