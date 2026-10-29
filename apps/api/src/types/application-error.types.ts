// @file apps/api/src/types/application-error.types.ts
export interface ApplicationError<T extends string> {
  code: T;
}
