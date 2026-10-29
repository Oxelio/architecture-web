import type { Result, ValueOf } from "@architecture/foundation";

import type { StrongAuthenticationError } from "#authentication/reauthentication.contracts";

export const RequestAccountDeletionErrors = {
  confirmationRequired: { code: "account_deletion.confirmation_required" },
  disabled: { code: "account_deletion.disabled" },
  notFound: { code: "user.not_found" },
  lastActiveAccess: { code: "administrator.last_active_access" },
  concurrentModification: { code: "account.concurrent_modification" },
} as const;

export interface RequestAccountDeletionInput {
  userId: string;
  sessionId: string;
  password: string;
  confirmation: string;
  code?: string;
}

export type RequestAccountDeletionError =
  ValueOf<typeof RequestAccountDeletionErrors> | StrongAuthenticationError;

export type RequestAccountDeletionOutput = Result<
  { scheduledFor: Date },
  RequestAccountDeletionError
>;

export interface RequestAccountDeletion {
  execute(
    input: RequestAccountDeletionInput,
  ): Promise<RequestAccountDeletionOutput>;
}
