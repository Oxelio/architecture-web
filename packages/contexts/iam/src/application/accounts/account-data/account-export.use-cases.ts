import { Result } from "@architecture/foundation";

import type { AccountSecurityPolicyReader } from "#accounts/account-policy.reader";
import type { SecurityTokens } from "#accounts/security-effects";
import type { IamResult } from "#application-result";
import type { Reauthentication } from "#authentication/reauthentication";
import { isSecurityOperationId } from "#domain/security-operation-id";
import type { SessionRepository } from "#repositories/session.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  AccountArchiveBuilder,
  AccountAuditData,
  AccountExportStore,
} from "./account-data.ports.js";
export class RequestAccountExportUseCase {
  constructor(
    private readonly policies: AccountSecurityPolicyReader,
    private readonly reauthentication: Reauthentication,
    private readonly store: AccountExportStore,
    private readonly sessions: SessionRepository,
    private readonly audit: AccountAuditData,
    private readonly archive: AccountArchiveBuilder,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(input: {
    userId: string;
    sessionId: string;
    password: string;
    code?: string;
  }): Promise<IamResult<{ id: string; status: string }>> {
    const captured = await this.policies.getAccountSecurityPolicy();
    if (!captured.accounts.export) {
      return Result.failure({ code: "EXPORT_DISABLED" } as const);
    }
    const authorized = await this.reauthentication.strong(
      input.userId,
      input.sessionId,
      input.password,
      input.code,
      captured.authentication,
    );
    if (!authorized.success) {
      return authorized;
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure({ code: "USER_NOT_FOUND" } as const);
    }
    const request = await this.store.reserve(
      input.userId,
      this.tokens.identifier(),
      new Date(),
    );
    if (!request) {
      return Result.failure({ code: "EXPORT_DISABLED" } as const);
    }
    if (!request.created) {
      return Result.success({ id: request.id, status: request.status });
    }
    try {
      const [data, sessions, auditEvents] = await Promise.all([
        this.store.readData(input.userId),
        this.sessions.findActiveForUser(id.value),
        this.audit.exportFor(input.userId),
      ]);
      const manifest = {
        format: "architecture-account-export",
        version: 2,
        generatedAt: new Date().toISOString(),
        files: [
          "account.json",
          "sessions.json",
          "security-events.json",
          "requests.json",
        ],
      };
      const files = {
        "manifest.json": JSON.stringify(manifest, null, 2),
        "account.json": JSON.stringify(data.account, null, 2),
        "sessions.json": JSON.stringify(
          sessions.map((session) => ({
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
            expiresAt: session.expiresAt,
            client: session.client,
            network: session.network,
          })),
          null,
          2,
        ),
        "security-events.json": JSON.stringify(auditEvents, null, 2),
        "requests.json": JSON.stringify(data.requests, null, 2),
      };
      await this.store.complete(
        request.id,
        this.archive.build(files),
        new Date(),
      );
    } catch (failure) {
      try {
        await this.store.fail(request.id, new Date());
      } catch (recordFailure) {
        throw new AggregateError(
          [failure, recordFailure],
          "Account export generation and failure recording failed",
        );
      }
      throw failure;
    }
    return Result.success({ id: request.id, status: "ready" });
  }
}
export class ListAccountExportsUseCase {
  constructor(private readonly store: AccountExportStore) {}
  async execute(input: {
    userId: string;
  }): Promise<
    IamResult<readonly import("./account-data.ports.js").AccountExportView[]>
  > {
    return Result.success(await this.store.list(input.userId, new Date()));
  }
}
export class DownloadAccountExportUseCase {
  constructor(private readonly store: AccountExportStore) {}
  async execute(input: {
    userId: string;
    exportId: string;
  }): Promise<IamResult<Uint8Array>> {
    if (!isSecurityOperationId(input.exportId)) {
      return Result.failure({ code: "EXPORT_NOT_AVAILABLE" } as const);
    }

    const archive = await this.store.take(
      input.userId,
      input.exportId,
      new Date(),
    );
    if (!archive) {
      return Result.failure({ code: "EXPORT_NOT_AVAILABLE" } as const);
    }
    return Result.success(archive);
  }
}
