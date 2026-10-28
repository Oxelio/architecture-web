import type { Result } from "@architecture/foundation";
export type IamResult<T> = Result<T, { readonly code: string }>;
