import type { Result, ValueOf } from "@architecture/foundation";

import type { UserRole } from "#value-objects/user-role.value-object";

export const ResolveSessionErrors = {
  unauthorized: {
    code: "session.unauthorized",
  },
} as const;

export type ResolveSessionError = ValueOf<typeof ResolveSessionErrors>;
export interface ResolveSessionInput {
  sessionId: string;
}

export interface SessionResolution {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export type ResolveSessionOutput = Result<
  SessionResolution,
  ResolveSessionError
>;

export interface ResolveSession {
  execute(payload: ResolveSessionInput): Promise<ResolveSessionOutput>;
}
