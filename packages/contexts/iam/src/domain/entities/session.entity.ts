// @file bounded-contexts/iam/domain/entities/session.entity.ts

import { AggregateRoot } from "@architecture/foundation";

import { SessionStarted } from "#domain/events/iam-domain-events";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export type SessionDeviceType = "desktop" | "phone" | "tablet" | "unknown";
export type SessionClientType = "browser" | "application" | "unknown";

export interface SessionClient {
  readonly type: SessionClientType;
  readonly name?: string;
  readonly version?: string;
  readonly deviceType: SessionDeviceType;
  readonly operatingSystem?: {
    readonly name: string;
    readonly version?: string;
  };
}

export interface ApproximateSessionLocation {
  readonly country: string;
  readonly region?: string;
  readonly city?: string;
}

export interface SessionNetwork {
  readonly ipAddress?: string;
  readonly location?: ApproximateSessionLocation;
}

interface SessionProperties {
  readonly identifier: SessionIdentifierValueObject;
  readonly userId: UserIdentifierValueObject;
  readonly userSessionVersion: number;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly lastActivityAt: Date;
  readonly client?: SessionClient;
  readonly network?: SessionNetwork;
}

interface SessionPropertiesCreationProperties {
  readonly userId: UserIdentifierValueObject;
  readonly userSessionVersion: number;
  readonly expiresAt: Date;
  readonly client?: SessionClient;
  readonly network?: SessionNetwork;
}

export class SessionEntity extends AggregateRoot<SessionProperties> {
  public static createForUser(properties: SessionPropertiesCreationProperties) {
    const now = new Date();
    if (
      !Number.isSafeInteger(properties.userSessionVersion) ||
      properties.userSessionVersion < 1
    ) {
      throw new Error("User session version must be a positive integer");
    }
    if (properties.expiresAt.getTime() <= now.getTime()) {
      throw new Error("Session expiration must be in the future");
    }
    const session = new SessionEntity({
      userId: properties.userId,
      userSessionVersion: properties.userSessionVersion,
      expiresAt: properties.expiresAt,
      identifier: SessionIdentifierValueObject.generate(),
      createdAt: now,
      lastActivityAt: now,
      ...(properties.client ? { client: properties.client } : {}),
      ...(properties.network ? { network: properties.network } : {}),
    });
    session.recordDomainEvent(
      new SessionStarted(properties.userId, session.identifier.value),
    );
    return session;
  }

  public static rehydrate(properties: SessionProperties) {
    if (
      !Number.isSafeInteger(properties.userSessionVersion) ||
      properties.userSessionVersion < 1
    ) {
      throw new Error("User session version must be a positive integer");
    }
    return new SessionEntity(properties);
  }

  public get userId(): UserIdentifierValueObject {
    return this.properties.userId;
  }

  public get userSessionVersion(): number {
    return this.properties.userSessionVersion;
  }

  public get expiresAt(): Date {
    return this.properties.expiresAt;
  }

  public get createdAt(): Date {
    return this.properties.createdAt;
  }

  public get lastActivityAt(): Date {
    return this.properties.lastActivityAt;
  }

  public get client(): SessionClient | undefined {
    return this.properties.client;
  }

  public get network(): SessionNetwork | undefined {
    return this.properties.network;
  }

  public isExpired(): boolean {
    return this.properties.expiresAt.getTime() <= Date.now();
  }

  public isValid(): boolean {
    return !this.isExpired();
  }
}
