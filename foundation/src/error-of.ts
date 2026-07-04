export type ErrorOf<T> = T[keyof T] extends infer U
  ? U extends (...args: any[]) => infer R
    ? R
    : U
  : never;
