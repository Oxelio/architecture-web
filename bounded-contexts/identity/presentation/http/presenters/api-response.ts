export interface ApiResponse<TData> {
  data: TData;
  meta?: Record<string, unknown>;
  links?: Record<string, string>;
}
