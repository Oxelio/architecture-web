export type ErrorOf<T> = T[keyof T] extends infer U
  ? U extends (...args: unknown[]) => infer R
    ? R
    : U
  : never;
