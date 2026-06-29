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
