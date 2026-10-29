import type { UserEntity } from "#entities/user.entity";
export interface AccountExportView {
  readonly id: string;
  readonly status: string;
  readonly failure_code: string | null;
  readonly expires_at: Date | null;
  readonly downloaded_at: Date | null;
  readonly created_at: Date;
}
export interface AccountExportStore {
  reserve(
    userId: string,
    id: string,
    now: Date,
  ): Promise<{ id: string; status: string; created: boolean } | null>;
  readData(userId: string): Promise<{
    account: Record<string, unknown>;
    requests: Record<string, unknown>;
  }>;
  complete(id: string, archive: Uint8Array, now: Date): Promise<void>;
  fail(id: string, now: Date): Promise<void>;
  list(userId: string, now: Date): Promise<readonly AccountExportView[]>;
  take(userId: string, id: string, now: Date): Promise<Uint8Array | null>;
  expire(now: Date): Promise<void>;
}
export interface AccountArchiveBuilder {
  build(files: Readonly<Record<string, string>>): Uint8Array;
}
export interface AccountAuditData {
  exportFor(userId: string): Promise<readonly Record<string, unknown>[]>;
  pseudonymize(userId: string): Promise<void>;
}
export interface DeletionRequest {
  readonly id: string;
  readonly userId: string;
  readonly previousStatus: string;
  readonly scheduledFor: Date;
  readonly cancelledAt: Date | null;
  readonly executedAt: Date | null;
}
export interface AccountDeletionStore {
  request(input: {
    user: UserEntity;
    previousStatus: string;
    requireAnotherAdministrator: boolean;
    id: string;
    tokenHash: string;
    now: Date;
    scheduledFor: Date;
  }): Promise<"saved" | "last_administrator" | "conflict">;
  find(tokenHash: string): Promise<DeletionRequest | null>;
  cancel(input: {
    user: UserEntity;
    requestId: string;
    now: Date;
  }): Promise<boolean>;
  due(now: Date): Promise<readonly DeletionRequest[]>;
  eraseIfDue(
    id: string,
    now: Date,
    beforeErase: (userId: string) => Promise<void>,
  ): Promise<string | null>;
}
