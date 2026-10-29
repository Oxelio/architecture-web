import type { ActivateMfa } from "#authentication/activate-mfa/activate-mfa.contracts";
import type { BeginMfaEnrollment } from "#authentication/begin-mfa-enrollment/begin-mfa-enrollment.contracts";
import type { BeginSecondFactor } from "#authentication/begin-second-factor/begin-second-factor.contracts";
import type { CompleteMfaSignIn } from "#authentication/complete-mfa-sign-in/complete-mfa-sign-in.contracts";
import type { ConfirmMfaEnrollment } from "#authentication/confirm-mfa-enrollment/confirm-mfa-enrollment.contracts";
import type { DisableMfa } from "#authentication/disable-mfa/disable-mfa.contracts";
import type { GetMfaStatus } from "#authentication/get-mfa-status/get-mfa-status.contracts";
import type { ListCurrentUserSessions } from "#authentication/list-current-user-sessions/list-current-user-sessions.contracts";
import type { RegenerateMfaBackupCodes } from "#authentication/regenerate-mfa-backup-codes/regenerate-mfa-backup-codes.contracts";
import type { ResolveSession } from "#authentication/resolve-session/resolve-session.contracts";
import type { RevokeCurrentUserSession } from "#authentication/revoke-current-user-session/revoke-current-user-session.contracts";
import type { SignIn } from "#authentication/sign-in/sign-in.contracts";
import type { SignOut } from "#authentication/sign-out/sign-out.contracts";

export interface AuthenticationApplication {
  listCurrentUserSessions: ListCurrentUserSessions;
  resolveSession: ResolveSession;
  revokeCurrentUserSession: RevokeCurrentUserSession;
  signIn: SignIn;
  signOut: SignOut;
  beginMfaEnrollment: BeginMfaEnrollment;
  confirmMfaEnrollment: ConfirmMfaEnrollment;
  activateMfa: ActivateMfa;
  getMfaStatus: GetMfaStatus;
  beginSecondFactor: BeginSecondFactor;
  completeMfaSignIn: CompleteMfaSignIn;
  regenerateBackupCodes: RegenerateMfaBackupCodes;
  disableMfa: DisableMfa;
}
