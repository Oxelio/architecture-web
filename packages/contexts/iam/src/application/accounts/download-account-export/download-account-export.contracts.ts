import type { Result, ValueOf } from "@architecture/foundation";

export const DownloadAccountExportErrors = {
  notAvailable: { code: "account_export.not_available" },
} as const;

export interface DownloadAccountExportInput {
  userId: string;
  exportId: string;
}

export type DownloadAccountExportError = ValueOf<
  typeof DownloadAccountExportErrors
>;

export type DownloadAccountExportOutput = Result<
  Uint8Array,
  DownloadAccountExportError
>;

export interface DownloadAccountExport {
  execute(
    input: DownloadAccountExportInput,
  ): Promise<DownloadAccountExportOutput>;
}
