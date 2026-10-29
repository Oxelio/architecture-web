// @file apps/api/src/types/http.types.ts

export type HttpErrorStatus =
  400 | 401 | 403 | 404 | 409 | 410 | 412 | 422 | 429 | 500;

export interface HttpError {
  readonly status: HttpErrorStatus;

  readonly body: {
    readonly error: {
      readonly code: string;
      readonly message?: string;
    };
  };
}

export interface HttpErrorDefinition<TCode extends string = string> {
  readonly status: HttpErrorStatus;

  readonly code: TCode;

  readonly message?: string;
}

export type HttpErrorDefinitions<TErrorCode extends string> = {
  readonly [TCode in TErrorCode]: HttpErrorDefinition<TCode>;
};

export type HttpSuccessStatus = 200 | 201 | 202 | 204;

export interface HttpSuccess<TBody = unknown> {
  readonly status: HttpSuccessStatus;

  readonly body?: TBody;
}

export interface HttpSuccessDefinition {
  readonly status: HttpSuccessStatus;

  readonly description: string;
}

export type HttpSuccessDefinitions<TSuccessCode extends string> = Record<
  TSuccessCode,
  HttpSuccessDefinition
>;

export interface HttpContract<
  TErrorCode extends string,
  TSuccessCode extends string,
> {
  readonly errors: HttpErrorDefinitions<TErrorCode>;

  readonly success: Record<TSuccessCode, HttpSuccessDefinition>;
  /* Maybe to add in futur

  readonly security?: {

    readonly authenticated?: boolean;

    readonly roles?: readonly string[];

  };

  readonly headers?: {

    readonly response?: readonly string[];

    readonly request?: readonly string[];

  };

  readonly cookies?: {

    readonly response?: readonly string[];

    readonly request?: readonly string[];

  };

  readonly contentType?: {

    readonly request?: string;

    readonly response?: string;

  }
  */
}
