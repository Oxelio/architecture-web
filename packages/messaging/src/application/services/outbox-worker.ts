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
    await this.repository.releaseStale(new Date(Date.now() - 5 * 60_000));
    const messages = await this.repository.claim(batchSize);
    for (const message of messages) {
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
      await this.repository.save(message);
    }
    return messages.length;
  }
}
