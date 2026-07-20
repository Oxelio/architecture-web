// @file foundation/src/domain/result.ts

export type Result<TValue, TError> =
  | {
      success: true;
      value: TValue;
    }
  | {
      success: false;
      error: TError;
    };

export const Result = {
  success<TValue>(value: TValue): Result<TValue, never> {
    return {
      success: true,
      value,
    };
  },

  failure<TError>(error: TError): Result<never, TError> {
    return {
      success: false,
      error,
    };
  },
};
