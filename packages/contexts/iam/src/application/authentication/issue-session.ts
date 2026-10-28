import type { OutboxWriter } from "@architecture/messaging/application";

import { SessionEntity } from "#entities/session.entity";
import type { UserEntity } from "#entities/user.entity";
import { toIamIntegrationEvent } from "#events/iam-integration-event";
import type { SessionRepository } from "#repositories/session.repository";

import type { SessionPolicyReader } from "./authentication-policy.reader.js";
export const MAX_ACTIVE_SESSIONS_PER_USER = 10;
export class IssueSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly policies: SessionPolicyReader,
    private readonly outbox: OutboxWriter,
  ) {}
  async issue(
    user: UserEntity,
    metadata?: Pick<
      Parameters<typeof SessionEntity.createForUser>[0],
      "client" | "network"
    >,
  ) {
    const policy = await this.policies.getSessionPolicy();
    const session = SessionEntity.createForUser({
      userId: user.identifier,
      userSessionVersion: user.sessionVersion,
      expiresAt: new Date(Date.now() + policy.durationMinutes * 60000),
      ...(metadata?.client ? { client: metadata.client } : {}),
      ...(metadata?.network ? { network: metadata.network } : {}),
    });
    await this.sessions.saveEnforcingMaximum(
      session,
      MAX_ACTIVE_SESSIONS_PER_USER,
    );
    await this.outbox.append(
      session.pullDomainEvents().map(toIamIntegrationEvent),
    );
    return {
      userId: user.identifier.value,
      sessionId: session.identifier.value,
      sessionExpiresAt: session.expiresAt,
    };
  }
}
