import { Result } from "@architecture/foundation";

import type {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import type { SecurityPolicy } from "#domain/security-policy";
import type { SessionRepository } from "#ports/session.repository";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

import type {
  CriticalConfigurationAdmissionError,
  CriticalConfigurationConfirmationStore,
  CriticalConfigurationRefusal,
} from "./critical-configuration-confirmation.store.js";

const ATTEMPT_LIFETIME_MS = 120_000;
const FINAL_SESSION_READ_TIMEOUT_MS = 2_000;

export class CriticalConfigurationConfirmation {
  constructor(
    private readonly store: CriticalConfigurationConfirmationStore,
    private readonly sessions: Pick<SessionRepository, "findById">,
    private readonly password: Pick<Reauthentication, "password">,
    private readonly factor: Pick<FactorVerification, "verify">,
    private readonly monotonicNow = () => performance.now(),
  ) {}

  async verify(input: {
    actorId: string;
    expectedVersion: number;
    sessionId: string;
    password: string;
    mfaCode?: string;
    authentication: SecurityPolicy["authentication"];
    startedAt: number;
  }): Promise<Result<number, CriticalConfigurationAdmissionError>> {
    const id = SessionIdentifierValueObject.create(input.sessionId);
    if (!id.success) {
      return Result.failure("session_invalid");
    }
    const session = await this.sessions.findById(id.value);
    if (
      !session ||
      session.userId.value !== input.actorId ||
      session.isExpired()
    ) {
      return Result.failure("session_invalid");
    }
    const deadline = input.startedAt + ATTEMPT_LIFETIME_MS;
    if (!PasswordPlainValueObject.create(input.password).success) {
      return Result.failure("confirmation_refused");
    }
    const normalizedFactor = input.mfaCode?.replace(/[\s-]/g, "");
    const admission = await this.store.admit(
      {
        actorId: input.actorId,
        expectedVersion: input.expectedVersion,
      },
      (state) => {
        if (
          session.isExpired() ||
          session.userSessionVersion !== state.sessionVersion
        ) {
          return "session_invalid";
        }
        if (
          this.monotonicNow() >= deadline ||
          (state.mfaEnabled && !normalizedFactor) ||
          (!state.mfaEnabled &&
            input.authentication.mfaRequiredRoles.includes("admin"))
        ) {
          return "confirmation_refused";
        }
        return undefined;
      },
    );
    if (!admission.success) {
      return admission;
    }
    const state = admission.value;
    if (this.monotonicNow() >= deadline) {
      return Result.failure("confirmation_refused");
    }
    const password = await this.password.password(
      input.actorId,
      input.password,
    );
    if (!password.success || this.monotonicNow() >= deadline) {
      return Result.failure("confirmation_refused");
    }
    if (state.mfaEnabled) {
      const factor = await this.factor.verify(
        input.actorId,
        normalizedFactor ?? "",
      );
      if (!factor.success) {
        return Result.failure("confirmation_refused");
      }
    }
    const refused = await this.store.authorize(input.actorId, state, () =>
      this.checkSession(
        id.value,
        input.actorId,
        state.sessionVersion,
        deadline,
      ),
    );
    return refused
      ? Result.failure(refused)
      : Result.success(state.sessionVersion);
  }

  private async checkSession(
    id: SessionIdentifierValueObject,
    actorId: string,
    sessionVersion: number,
    deadline: number,
  ): Promise<CriticalConfigurationRefusal | undefined> {
    const now = this.monotonicNow();
    if (now >= deadline) {
      return "confirmation_refused";
    }
    const technicalDeadline = now + FINAL_SESSION_READ_TIMEOUT_MS;
    const stopAt = Math.min(deadline, technicalDeadline);
    const onTimeout = () => {
      if (deadline <= technicalDeadline) {
        return "confirmation_refused" as const;
      }
      throw new Error("Critical configuration session lookup timed out");
    };
    const timedOut = Symbol("session lookup timeout");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), Math.ceil(stopAt - now));
      });
      const lookup = this.sessions.findById(id).then(
        (session) => ({ session }),
        (error: unknown) => ({ error }),
      );
      const outcome = await Promise.race([lookup, timeout]);
      if (outcome === timedOut || this.monotonicNow() >= stopAt) {
        return onTimeout();
      }
      if ("error" in outcome) {
        throw outcome.error;
      }
      const { session } = outcome;
      if (
        !session ||
        session.userId.value !== actorId ||
        session.userSessionVersion !== sessionVersion ||
        session.isExpired()
      ) {
        return "session_invalid";
      }
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }
}
