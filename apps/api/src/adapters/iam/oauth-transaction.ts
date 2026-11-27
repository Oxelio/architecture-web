import { AsyncLocalStorage } from "node:async_hooks";

import type {
  DelegatedAuthorizationReader,
  DelegatedAuthorizationWriter,
  SessionRepository,
} from "@architecture/iam/application";
import { SessionIdentifierValueObject } from "@architecture/iam/domain";
import type {
  IamDatabase,
  KyselyDelegatedAuthorizationAdapter,
} from "@architecture/iam-persistence-kysely";
import type { Transaction } from "kysely";

export function createOAuthTransactions(
  store: KyselyDelegatedAuthorizationAdapter,
  sessions: SessionRepository,
) {
  const scope = new AsyncLocalStorage<OAuthTransaction>();
  return {
    current() {
      const current = scope.getStore();
      if (!current) {
        throw new Error("OAuth operation requires a bound transaction");
      }
      current.assertTime();
      return current;
    },
    run<T>(
      mode: "exclusive" | "shared",
      deadline: number,
      execute: (transaction: OAuthTransaction) => Promise<T>,
    ) {
      if (scope.getStore()) {
        throw new Error("Nested OAuth transaction");
      }
      return store.protocolTransaction(mode, deadline, (db, reader) => {
        const context = new OAuthTransaction(
          db,
          reader,
          store,
          sessions,
          deadline,
        );
        return scope.run(context, () => execute(context));
      });
    },
  };
}

export type OAuthTransactions = ReturnType<typeof createOAuthTransactions>;

export class OAuthTransaction {
  private locked?: { accountId: string; writer: DelegatedAuthorizationWriter };
  replay = false;
  serverError = false;
  protocolError = false;
  actor: { accountId: string; sessionId: string } | undefined;
  readonly requestedFamilies = new Map<string, Date>();

  constructor(
    readonly db: Transaction<IamDatabase>,
    readonly reader: DelegatedAuthorizationReader,
    private readonly store: KyselyDelegatedAuthorizationAdapter,
    private readonly sessions: SessionRepository,
    private readonly deadline: number,
  ) {}

  assertTime() {
    if (performance.now() >= this.deadline) {
      throw new Error("OAuth request deadline elapsed");
    }
  }

  async lock(accountId: string) {
    this.assertTime();
    if (this.locked) {
      if (this.locked.accountId !== accountId) {
        throw new Error("OAuth request account changed");
      }
      return this.locked.writer;
    }
    const writer = await this.store.bindWriter(this.db, accountId);
    this.locked = { accountId, writer };
    return writer;
  }

  async session(raw: string | undefined) {
    if (!raw) {
      return;
    }
    const id = SessionIdentifierValueObject.create(raw);
    if (!id.success) {
      return;
    }
    const time = Math.min(2_000, Math.floor(this.deadline - performance.now()));
    if (time <= 0) {
      throw new Error("OAuth session read deadline elapsed");
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const session = await Promise.race([
        this.sessions.findById(id.value),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("OAuth session read timed out")),
            time,
          );
        }),
      ]);
      if (!session || session.isExpired()) {
        return;
      }
      this.assertTime();
      const user = await this.db
        .selectFrom("iam_users")
        .select(["status", "session_version"])
        .where("id", "=", session.userId.value)
        .executeTakeFirst();
      if (
        user?.status === "active" &&
        user.session_version === session.userSessionVersion &&
        !session.isExpired()
      ) {
        return { accountId: session.userId.value, sessionId: id.value.value };
      }
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }
}
