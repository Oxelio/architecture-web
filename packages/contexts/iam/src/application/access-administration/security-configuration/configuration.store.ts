import type { SecurityPolicy } from "#domain/security-policy";
export interface ConfigurationRevision {
  readonly id: string;
  readonly version: number;
  readonly values: SecurityPolicy;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly previousRevisionId: string | null;
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
  history(): Promise<readonly ConfigurationRevisionMetadata[]>;
  find(id: string): Promise<StoredConfigurationRevision | null>;
  publish(input: {
    actorId: string;
    values: SecurityPolicy;
    expectedVersion: number;
    justification: string;
    changedKeys: readonly string[];
  }): Promise<ConfigurationRevision | null>;
  countAdministratorsWithoutMfa(): Promise<number>;
}
