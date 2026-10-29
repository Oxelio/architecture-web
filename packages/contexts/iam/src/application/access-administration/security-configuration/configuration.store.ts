import type { SecurityPolicy } from "#domain/security-policy";
export interface ConfigurationRevision {
  readonly id: string;
  readonly version: number;
  readonly values: SecurityPolicy;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly previousRevisionId: string | null;
  readonly representationVersion?: number;
  readonly status?: string;
  readonly publishedAt?: Date | null;
  readonly changes?:
    readonly { key: string; before: unknown; after: unknown }[] | null;
  readonly justification?: string | null;
  readonly origin?: string | null;
  readonly restoredFromRevisionId?: string | null;
}
export type ConfigurationRevisionMetadata = Omit<
  ConfigurationRevision,
  "values"
>;
export type StoredConfigurationRevision = ConfigurationRevisionMetadata & {
  readonly values: unknown;
};
export interface PublishedConfigurationReader {
  readPublished(): Promise<ConfigurationRevision>;
}
export interface ConfigurationStore extends PublishedConfigurationReader {
  initialize(): Promise<void>;
  readCenter(): Promise<{
    published: ConfigurationRevision;
    revisions: readonly ConfigurationRevisionMetadata[];
  }>;
  history(): Promise<readonly ConfigurationRevisionMetadata[]>;
  find(id: string): Promise<StoredConfigurationRevision | null>;
  publish(input: {
    actorId: string;
    values: SecurityPolicy;
    expectedVersion: number;
    expectedActorSessionVersion?: number;
    justification: string;
    changedKeys: readonly string[];
    origin?: "administration" | "restoration";
    restoredFromRevisionId?: string;
  }): Promise<
    | ConfigurationRevision
    | "last_administrator"
    | "unauthorized"
    | "reauthentication_required"
    | null
  >;
  countAdministratorsWithoutMfa(): Promise<number>;
}
