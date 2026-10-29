import type { Result } from "@architecture/foundation";

export type MaintainIamAccountsError = never;

export type MaintainIamAccountsOutput = Result<
  { deletedAccounts: number },
  MaintainIamAccountsError
>;

export interface MaintainIamAccounts {
  execute(): Promise<MaintainIamAccountsOutput>;
}
