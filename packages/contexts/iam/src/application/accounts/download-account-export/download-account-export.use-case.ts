import { Result } from "@architecture/foundation";

import type { AccountExportStore } from "#accounts/account-data/account-data.ports";
import { isSecurityOperationId } from "#domain/security-operation-id";

import {
  type DownloadAccountExport,
  DownloadAccountExportErrors,
  type DownloadAccountExportInput,
  type DownloadAccountExportOutput,
} from "./download-account-export.contracts.js";

export class DownloadAccountExportUseCase implements DownloadAccountExport {
  constructor(private readonly store: AccountExportStore) {}
  async execute(
    input: DownloadAccountExportInput,
  ): Promise<DownloadAccountExportOutput> {
    if (!isSecurityOperationId(input.exportId)) {
      return Result.failure(DownloadAccountExportErrors.notAvailable);
    }

    const archive = await this.store.take(
      input.userId,
      input.exportId,
      new Date(),
    );
    if (!archive) {
      return Result.failure(DownloadAccountExportErrors.notAvailable);
    }
    return Result.success(archive);
  }
}
