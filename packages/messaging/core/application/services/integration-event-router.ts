import type { IntegrationEvent } from "@architecture/messaging/domain";

export interface IntegrationEventHandler {
  readonly topics: readonly string[];
  handle(event: IntegrationEvent): Promise<void>;
}

export class IntegrationEventRouter {
  readonly #handlers = new Map<string, IntegrationEventHandler[]>();

  constructor(handlers: readonly IntegrationEventHandler[] = []) {
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  register(handler: IntegrationEventHandler): void {
    for (const topic of handler.topics) {
      const registered = this.#handlers.get(topic) ?? [];
      registered.push(handler);
      this.#handlers.set(topic, registered);
    }
  }

  async dispatch(event: IntegrationEvent): Promise<void> {
    for (const handler of this.#handlers.get(event.topic) ?? []) {
      await handler.handle(event);
    }
  }
}
