// @file infrastructure/identity/persitence/kysely/src/errors/invalid-persistence-data.error.ts

export class InvalidPersistenceDataError extends Error {
  constructor(entity: string, field: string, value: unknown) {
    super(
      `Cannot rehydrate ${entity}: invalid '${field}' value (${String(value)})`,
    );

    this.name = "InvalidPersistenceDataError";
  }
}
