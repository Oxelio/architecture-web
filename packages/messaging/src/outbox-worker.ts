import { IntegrationEventRouter } from "./event-router.js";
import { KyselyOutboxStore, rowToIntegrationEvent } from "./kysely-outbox.js";

export interface OutboxWorkerLogger {
  error(details: unknown, message: string): void;
}

export class OutboxWorker {
  #timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly store: KyselyOutboxStore,
    private readonly router: IntegrationEventRouter,
    private readonly logger: OutboxWorkerLogger = console,
  ) {}

  start(intervalMs = 1_000): void {
    if (this.#timer) {
      return;
    }
    this.#timer = setInterval(() => {
      void this.drain().catch((error: unknown) => {
        this.logger.error({ error }, "Outbox polling failed");
      });
    }, intervalMs);
    this.#timer.unref();
  }

  stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  async drain(batchSize = 50): Promise<number> {
    await this.store.releaseStale(new Date(Date.now() - 5 * 60_000));
    const rows = await this.store.claim(batchSize);
    for (const row of rows) {
      try {
        await this.router.dispatch(rowToIntegrationEvent(row));
        await this.store.published(row.id);
      } catch (error) {
        await this.store.failed(row.id, row.attempts + 1, error);
        this.logger.error({ error, eventId: row.id }, "Outbox dispatch failed");
      }
    }
    return rows.length;
  }
}
