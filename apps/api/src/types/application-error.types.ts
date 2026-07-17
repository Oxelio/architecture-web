// @file apps/api/src/types/application-error.types.ts
export interface ApplicationError<T extends string = string> {
  code: T;
  details?: unknown;
}
