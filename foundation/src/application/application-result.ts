// @file foundation/src/application/application-result.ts

import type { Result } from "#domain/result";

export interface SuccessResult<TCode extends string, TData> {
  code: TCode;
  data: TData;
}

export type ApplicationResult<TCode extends string, TData, TError> = Result<
  SuccessResult<TCode, TData>,
  TError
>;
