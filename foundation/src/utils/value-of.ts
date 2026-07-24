// @file foundation/src/value-of.ts
type UnwrapValue<T> = T extends (...args: never[]) => infer R ? R : T;

export type ValueOf<T> = UnwrapValue<T[keyof T]>;
