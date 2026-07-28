// @file bounded-contexts/identity/domain/entities/session.entity.ts

import { Entity } from "@architecture/foundation";

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
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly lastActivityAt: Date;
  readonly client?: SessionClient;
  readonly network?: SessionNetwork;
}

interface SessionPropertiesCreationProperties {
  readonly userId: UserIdentifierValueObject;
  readonly client?: SessionClient;
  readonly network?: SessionNetwork;
}

export class SessionEntity extends Entity<SessionProperties> {
  private static readonly SESSION_LIFETIME_MINUTES = 60;

  public static createForUser(properties: SessionPropertiesCreationProperties) {
    const now = new Date();
    return new SessionEntity({
      userId: properties.userId,
      expiresAt: SessionEntity.expirationDate(),
      identifier: SessionIdentifierValueObject.generate(),
      createdAt: now,
      lastActivityAt: now,
      ...(properties.client ? { client: properties.client } : {}),
      ...(properties.network ? { network: properties.network } : {}),
    });
  }

  public static rehydrate(props: SessionProperties) {
    return new SessionEntity(props);
  }

  public get userId(): UserIdentifierValueObject {
    return this.props.userId;
  }

  public get expiresAt(): Date {
    return this.props.expiresAt;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get lastActivityAt(): Date {
    return this.props.lastActivityAt;
  }

  public get client(): SessionClient | undefined {
    return this.props.client;
  }

  public get network(): SessionNetwork | undefined {
    return this.props.network;
  }

  public isExpired(): boolean {
    return this.props.expiresAt.getTime() <= Date.now();
  }

  public isValid(): boolean {
    return !this.isExpired();
  }

  private static expirationDate(): Date {
    return new Date(Date.now() + this.SESSION_LIFETIME_MINUTES * 60 * 1000);
  }
}
