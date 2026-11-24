import { Result } from "@architecture/foundation";

import type {
  AccountDeletionStore,
  AccountExportStore,
} from "#accounts/account-data/account-data.ports";
import type { SessionRepository } from "#ports/session.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  MaintainIamAccounts,
  MaintainIamAccountsOutput,
} from "./maintain-iam-accounts.contracts.js";

export class MaintainIamAccountsUseCase implements MaintainIamAccounts {
  constructor(
    private readonly deletions: AccountDeletionStore,
    private readonly exports: AccountExportStore,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(): Promise<MaintainIamAccountsOutput> {
    const now = new Date();
    const due = await this.deletions.due(now);

    const deletedAccounts = await due.reduce<Promise<number>>(
      async (previous, request) => {
        const count = await previous;
        const deleted = await this.eraseAccount(request.id, now);

        return count + Number(deleted);
      },
      Promise.resolve(0),
    );

    await this.exports.expire(now);

    return Result.success({ deletedAccounts });
  }

  private async eraseAccount(requestId: string, now: Date): Promise<boolean> {
    const userId = await this.deletions.eraseIfDue(requestId, now);

    if (!userId) {
      return false;
    }

    const id = UserIdentifierValueObject.create(userId);

    if (!id.success) {
      throw new Error("Invalid persisted account identifier");
    }

    await this.sessions.deleteAllForUser(id.value);

    return true;
  }
}
