import type { IntegrationEvent } from "@architecture/messaging/domain";

import { OutboxRepository } from "#repositories/outbox.repository";

export interface OutboxWorkerLogger {
  error(details: unknown, message: string): void;
}

export interface IntegrationEventDispatcher {
  dispatch(event: IntegrationEvent): Promise<void>;
}

export class OutboxWorker {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly router: IntegrationEventDispatcher,
    private readonly logger: OutboxWorkerLogger = console,
  ) {}

  async drain(batchSize = 50): Promise<number> {
    await this.repository.recoverStale();
    let processed = 0;
    while (processed < batchSize) {
      const claim = await this.repository.claim();
      if (!claim) {
        break;
      }
      const { message } = claim;
      try {
        await this.router.dispatch(message.event);
        message.markPublished();
      } catch (error) {
        message.markFailed(error);
        this.logger.error(
          { error, eventId: message.identifier.value },
          "Outbox dispatch failed",
        );
      }
      if (!(await this.repository.finalize(claim))) {
        this.logger.error(
          { eventId: message.identifier.value },
          "Outbox claim expired or replaced",
        );
      }
      processed += 1;
    }
    return processed;
  }
}
