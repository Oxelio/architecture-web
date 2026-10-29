import type { Result } from "@architecture/foundation";

export interface ListAccountExportsInput {
  userId: string;
}

export type ListAccountExportsError = never;

export type ListAccountExportsOutput = Result<
  readonly import("#accounts/account-data/account-data.ports").AccountExportView[],
  ListAccountExportsError
>;

export interface ListAccountExports {
  execute(input: ListAccountExportsInput): Promise<ListAccountExportsOutput>;
}
