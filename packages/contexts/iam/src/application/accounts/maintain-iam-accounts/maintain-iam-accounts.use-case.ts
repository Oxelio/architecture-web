import { Result } from "@architecture/foundation";

import type {
  AccountAuditData,
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
    private readonly audit: AccountAuditData,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(): Promise<MaintainIamAccountsOutput> {
    const now = new Date(),
      due = await this.deletions.due(now);
    let deletedAccounts = 0;
    for (const request of due) {
      const userId = await this.deletions.eraseIfDue(request.id, now, (id) =>
        this.audit.pseudonymize(id),
      );
      if (!userId) {
        continue;
      }
      deletedAccounts++;
      const id = UserIdentifierValueObject.create(userId);
      if (!id.success) {
        throw new Error("Invalid persisted account identifier");
      }
      await this.sessions.deleteAllForUser(id.value);
    }
    await this.exports.expire(now);
    return Result.success({ deletedAccounts });
  }
}
