// apps/api/src/presentation/http.types.ts

export interface HttpError {
  status: number;
  body: {
    error: {
      code: string;
      message?: string;
      details?: unknown;
    };
  };
}

export interface HttpSuccess<TData> {
  status: number;
  body: {
    data: TData;
    meta?: Record<string, unknown>;
    links?: Record<string, string>;
  };
}
