// @file bounded-contexts/iam/application/use-cases/sign-in/sign-in.use-case.ts

import { Result } from "@architecture/foundation";

import type { SignInPolicyReader } from "#authentication/authentication-policy.reader";
import type { IssueSession } from "#authentication/issue-session";
import type { BeginSecondFactorUseCase } from "#authentication/mfa/mfa.use-cases";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#ports/password-authenticator.repository";
import type { UserRepository } from "#ports/user.repository";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

import { SignInErrorCodes } from "./sign-in.codes.js";
import type {
  AuthenticationSession,
  SignIn,
  SignInInput,
  SignInOutput,
} from "./sign-in.contracts.js";

export class SignInUseCase implements SignIn {
  constructor(
    private readonly user: UserRepository,
    private readonly loginIdentities: LoginIdentityRepository,
    private readonly passwordAuthenticators: PasswordAuthenticatorRepository,
    private readonly password: PasswordHasher,
    private readonly policies: SignInPolicyReader,
    private readonly secondFactor: Pick<BeginSecondFactorUseCase, "execute">,
    private readonly issueSession: IssueSession,
  ) {}

  async execute(payload: SignInInput): Promise<SignInOutput> {
    const captured = await this.policies.getSignInPolicy();
    const { allowedLoginIdentifiers } = captured.accounts;
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

    if (
      !(await this.passwordAuthenticators.recordSuccessfulUse(
        authenticator,
        new Date(),
      ))
    ) {
      return Result.failure(SignInErrorCodes.invalidCredentials);
    }

    if (!user.status.isActive()) {
      return Result.failure(SignInErrorCodes.userSuspended);
    }

    const challenge = await this.secondFactor.execute({
      userId: user.identifier.value,
      expectedSessionVersion: user.sessionVersion,
      policy: captured.authentication,
    });
    if (!challenge.success) {
      return challenge;
    }
    if (challenge.value) {
      return Result.success(challenge.value);
    }
    const data: AuthenticationSession = await this.issueSession.issue(
      user,
      payload,
      captured.sessions,
    );
    return Result.success(data);
  }
}
