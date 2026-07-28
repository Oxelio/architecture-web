// @file bounded-contexts/iam/application/use-cases/resolve-session/resolve-session.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { UserRole } from "#value-objects/user-role.value-object";

import type { ResolveSessionErrorCodes } from "./resolve-session.codes.js";

export type ResolveSessionError = ValueOf<typeof ResolveSessionErrorCodes>;
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
