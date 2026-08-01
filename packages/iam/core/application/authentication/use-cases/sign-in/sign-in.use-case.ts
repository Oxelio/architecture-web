// @file bounded-contexts/iam/application/use-cases/sign-in/sign-in.use-case.ts

import { Result } from "@architecture/foundation";
import type { OutboxWriter } from "@architecture/messaging/application";

import { SessionEntity } from "#entities/session.entity";
import { toIamIntegrationEvent } from "#events/iam-integration-event";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#repositories/password-authenticator.repository";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { IamPolicyProvider } from "#services/iam-policy-provider.service";
import type { PasswordHasher } from "#services/password-hasher.service";
import type { SecondFactorGate } from "#services/second-factor-gate.service";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

import { SignInErrorCodes } from "./sign-in.codes.js";
import type {
  AuthenticationSession,
  SignIn,
  SignInInput,
  SignInOutput,
} from "./sign-in.contracts.js";

export const MAX_ACTIVE_SESSIONS_PER_USER = 10;

export class SignInUseCase implements SignIn {
  constructor(
    private readonly user: UserRepository,
    private readonly loginIdentities: LoginIdentityRepository,
    private readonly passwordAuthenticators: PasswordAuthenticatorRepository,
    private readonly password: PasswordHasher,
    private readonly session: SessionRepository,
    private readonly policyProvider: IamPolicyProvider,
    private readonly secondFactor?: SecondFactorGate,
    private readonly outbox?: OutboxWriter,
  ) {}

  async execute(payload: SignInInput): Promise<SignInOutput> {
    const allowedLoginIdentifiers: readonly ("username" | "email")[] = (
      await this.policyProvider.getAccountIdentityPolicy?.()
    )?.allowedLoginIdentifiers ?? ["email"];
    if (!allowedLoginIdentifiers.includes(payload.login.kind)) {
      await this.password.fakeVerify();
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    const login = LoginIdentifierValueObject.create(
      payload.login.kind,
      payload.login.value,
    );
    if (!login.success) {
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    const identity = await this.loginIdentities.findByLogin(login.value);
    if (!identity || !identity.isUsable) {
      await this.password.fakeVerify(); // Timing attack prevention

      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    const user = await this.user.findById(identity.userId);
    const authenticator = user
      ? await this.passwordAuthenticators.findForUser(user.identifier)
      : null;
    if (!user || !authenticator || authenticator.isRevoked) {
      await this.password.fakeVerify();
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    const passwordVerified = await this.password.verify(
      password.value,
      authenticator.passwordHash,
    );
    if (!passwordVerified) {
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    authenticator.recordSuccessfulUse();
    await this.passwordAuthenticators.save(authenticator);

    if (!user.status.isActive()) {
      return Result.failure(SignInErrorCodes.userSuspended);
    }

    const challenge = await this.secondFactor?.beginSignIn(
      user.identifier.value,
    );
    if (challenge) {
      return Result.success(challenge);
    }

    const sessionDurationMinutes =
      await this.policyProvider.getSessionDurationMinutes();
    const sessionEntity = SessionEntity.createForUser({
      userId: user.identifier,
      userSessionVersion: user.sessionVersion,
      expiresAt: new Date(Date.now() + sessionDurationMinutes * 60_000),
      ...(payload.client ? { client: payload.client } : {}),
      ...(payload.network ? { network: payload.network } : {}),
    });

    await this.session.saveEnforcingMaximum(
      sessionEntity,
      MAX_ACTIVE_SESSIONS_PER_USER,
    );
    if (this.outbox) {
      await this.outbox.append(
        sessionEntity.pullDomainEvents().map(toIamIntegrationEvent),
      );
    }

    const data: AuthenticationSession = {
      userId: user.identifier.value,
      sessionId: sessionEntity.identifier.value,
      sessionExpiresAt: sessionEntity.expiresAt,
    };

    return Result.success(data);
  }
}
