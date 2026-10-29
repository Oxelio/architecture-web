import { Result } from "@architecture/foundation";

import type { AuthenticationPolicyReader } from "#authentication/authentication-policy.reader";
import type { MfaCryptography, MfaStore } from "#authentication/mfa/mfa.ports";
import type { Reauthentication } from "#authentication/reauthentication";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  type BeginMfaEnrollment,
  BeginMfaEnrollmentErrors,
  type BeginMfaEnrollmentInput,
  type BeginMfaEnrollmentOutput,
} from "./begin-mfa-enrollment.contracts.js";

export class BeginMfaEnrollmentUseCase implements BeginMfaEnrollment {
  constructor(
    private readonly reauthentication: Reauthentication,
    private readonly policies: AuthenticationPolicyReader,
    private readonly users: UserRepository,
    private readonly identities: LoginIdentityRepository,
    private readonly store: MfaStore,
    private readonly crypto: MfaCryptography,
  ) {}
  async execute(
    input: BeginMfaEnrollmentInput,
  ): Promise<BeginMfaEnrollmentOutput> {
    const authentication = await this.policies.getAuthenticationPolicy();
    const authorized = await this.reauthentication.recent(
      input.userId,
      input.sessionId,
      input.password,
      authentication,
    );
    if (!authorized.success) {
      return authorized;
    }
    if (!authentication.mfaAvailable) {
      return Result.failure(BeginMfaEnrollmentErrors.unavailable);
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure(BeginMfaEnrollmentErrors.notFound);
    }
    const user = await this.users.findById(id.value);
    if (!user) {
      return Result.failure(BeginMfaEnrollmentErrors.notFound);
    }
    const email = await this.identities.findForUser(id.value, "email"),
      secret = this.crypto.generateSecret(),
      now = new Date(),
      expiresAt = new Date(now.getTime() + 600000);
    if (
      !(await this.store.beginEnrollment(
        {
          userId: input.userId,
          sealedSecret: this.crypto.seal(secret),
          enrollmentExpiresAt: expiresAt,
          enabledAt: null,
          lastCounter: null,
        },
        now,
      ))
    ) {
      return Result.failure(BeginMfaEnrollmentErrors.alreadyEnabled);
    }
    const uri = `otpauth://totp/${encodeURIComponent("Architecture")}:${encodeURIComponent(email?.login.value ?? input.userId)}?secret=${secret}&issuer=Architecture&algorithm=SHA1&digits=6&period=30`;
    return Result.success({
      secret,
      otpauthUri: uri,
      qrCodeDataUrl: await this.crypto.qrCode(uri),
      expiresAt,
    });
  }
}
