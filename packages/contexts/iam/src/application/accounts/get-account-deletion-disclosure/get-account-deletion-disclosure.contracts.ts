import type { Result } from "@architecture/foundation";

export interface AccountDeletionDisclosure {
  enabled: boolean;
  gracePeriodDays: number;
}

export type GetAccountDeletionDisclosureOutput = Result<
  AccountDeletionDisclosure,
  never
>;

export interface GetAccountDeletionDisclosure {
  execute(): Promise<GetAccountDeletionDisclosureOutput>;
}
