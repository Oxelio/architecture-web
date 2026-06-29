export interface HttpSuccess<TData> {
  status: number;
  body: {
    data: TData;
    meta?: Record<string, unknown>;
    links?: Record<string, string>;
  };
}
