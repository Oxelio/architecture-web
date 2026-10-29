import type { Result, ValueOf } from "@architecture/foundation";

import type { StrongAuthenticationError } from "#authentication/reauthentication.contracts";

export const RequestAccountExportErrors = {
  disabled: { code: "account_export.disabled" },
  notFound: { code: "user.not_found" },
} as const;

export interface RequestAccountExportInput {
  userId: string;
  sessionId: string;
  password: string;
  code?: string;
}

export type RequestAccountExportError =
  ValueOf<typeof RequestAccountExportErrors> | StrongAuthenticationError;

export type RequestAccountExportOutput = Result<
  { id: string; status: string },
  RequestAccountExportError
>;

export interface RequestAccountExport {
  execute(
    input: RequestAccountExportInput,
  ): Promise<RequestAccountExportOutput>;
}
