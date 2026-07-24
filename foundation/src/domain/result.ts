// @file foundation/src/domain/result.ts

// type Success<T> = T extends void
//   ? { success: true }
//   : { success: true; value: T };

type Success<TValue> = { success: true; value: TValue };

type Failure<TError> = {
  success: false;
  error: TError;
};

export type Result<TValue, TError> = Success<TValue> | Failure<TError>;

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
