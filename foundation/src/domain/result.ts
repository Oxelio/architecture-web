type Result<TValue, TError> =
  | {
      success: true;
      value: TValue;
    }
  | {
      success: false;
      error: TError;
    };

const Result = {
  ok<T>(value?: T): Result<T | undefined, never> {
    return {
      success: true,
      value: value as T,
    };
  },

  failure<E>(error: E): Result<never, E> {
    return {
      success: false,
      error,
    };
  },
};
