import { Result } from "@architecture/foundation";

import type { AccountPolicyReader } from "#accounts/account-policy.reader";

import type {
  GetAccountDeletionDisclosure,
  GetAccountDeletionDisclosureOutput,
} from "./get-account-deletion-disclosure.contracts.js";

export class GetAccountDeletionDisclosureUseCase implements GetAccountDeletionDisclosure {
  constructor(private readonly policies: AccountPolicyReader) {}

  async execute(): Promise<GetAccountDeletionDisclosureOutput> {
    const accounts = await this.policies.getAccountPolicy();
    return Result.success({
      enabled: accounts.deletion,
      gracePeriodDays: accounts.deletionGraceDays,
    });
  }
}
