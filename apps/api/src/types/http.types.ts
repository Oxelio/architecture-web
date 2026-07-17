// @file apps/api/src/types/http.types.ts

export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;

export type HttpSuccessStatus = 200 | 201 | 202 | 204;

export interface HttpError {
  status: HttpErrorStatus;

  body: {
    error: {
      code: string;
      message?: string;
    };
  };
}

export interface HttpErrorDefinition {
  status: HttpErrorStatus;
  code: string;
  message?: string;
}

export type HttpErrorDefinitions<TErrorCode extends string> = Record<
  TErrorCode,
  HttpErrorDefinition
>;

export interface HttpSuccessDefinition {
  status: HttpSuccessStatus;
  description?: string;
  schema?: Record<string, unknown>;
}

export type HttpSuccessDefinitions<TSuccessCode extends string = string> =
  Record<TSuccessCode, HttpSuccessDefinition>;
