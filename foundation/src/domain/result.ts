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

function ok(): Result<undefined, never>;
function ok<T>(value: T): Result<T, never>;
function ok<T>(value?: T): Result<T | undefined, never> {
  return {
    success: true,
    value: value as T,
  };
}

export const Result = {
  ok,

  failure<E>(error: E): Result<never, E> {
    return {
      success: false,
      error,
    };
  },
};
