import { Result } from "@architecture/foundation";

import type { AccountExportStore } from "#accounts/account-data/account-data.ports";

import type {
  ListAccountExports,
  ListAccountExportsInput,
  ListAccountExportsOutput,
} from "./list-account-exports.contracts.js";

export class ListAccountExportsUseCase implements ListAccountExports {
  constructor(private readonly store: AccountExportStore) {}
  async execute(
    input: ListAccountExportsInput,
  ): Promise<ListAccountExportsOutput> {
    return Result.success(await this.store.list(input.userId, new Date()));
  }
}
