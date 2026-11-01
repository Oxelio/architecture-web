import {
  createPasswordPolicy,
  type PasswordPolicy,
  type PasswordPolicyProfile,
} from "#domain/password-policy";
export interface PasswordPolicyReader {
  get(profile: PasswordPolicyProfile): Promise<PasswordPolicy>;
}
export class FixedPasswordPolicyReader implements PasswordPolicyReader {
  private readonly profiles: Readonly<
    Record<PasswordPolicyProfile, PasswordPolicy>
  >;
  constructor(
    profiles: Readonly<Record<PasswordPolicyProfile, PasswordPolicy>>,
  ) {
    this.profiles = Object.freeze({
      standard: createPasswordPolicy(
        profiles.standard.level,
        profiles.standard,
      ),
      privileged: createPasswordPolicy(
        profiles.privileged.level,
        profiles.privileged,
      ),
    });
  }
  get(profile: PasswordPolicyProfile): Promise<PasswordPolicy> {
    try {
      return Promise.resolve(this.profiles[profile]);
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
