import type { ActivateUser } from "#access-administration/activate-user/activate-user.contracts";
import type { AssignUserRole } from "#access-administration/assign-user-role/assign-user-role.contracts";
import type { GetIamCapabilities } from "#access-administration/get-iam-capabilities/get-iam-capabilities.contracts";
import type { GetSecurityConfiguration } from "#access-administration/get-security-configuration/get-security-configuration.contracts";
import type { GetUserAdministrationOverview } from "#access-administration/get-user-administration-overview/get-user-administration-overview.contracts";
import type { ListUserSessions } from "#access-administration/list-user-sessions/list-user-sessions.contracts";
import type { ListUsers } from "#access-administration/list-users/list-users.contracts";
import type { PreviewSecurityConfiguration } from "#access-administration/preview-security-configuration/preview-security-configuration.contracts";
import type { PublishSecurityConfiguration } from "#access-administration/publish-security-configuration/publish-security-configuration.contracts";
import type { RestoreSecurityConfiguration } from "#access-administration/restore-security-configuration/restore-security-configuration.contracts";
import type { RevokeUserSession } from "#access-administration/revoke-user-session/revoke-user-session.contracts";
import type { SuspendUser } from "#access-administration/suspend-user/suspend-user.contracts";

export interface AdministrationApplication {
  assignUserRole: AssignUserRole;
  activateUser: ActivateUser;
  getUserAdministrationOverview: GetUserAdministrationOverview;
  listUsers: ListUsers;
  listUserSessions: ListUserSessions;
  revokeUserSession: RevokeUserSession;
  suspendUser: SuspendUser;
  getCapabilities: GetIamCapabilities;
  getConfiguration: GetSecurityConfiguration;
  previewConfiguration: PreviewSecurityConfiguration;
  publishConfiguration: PublishSecurityConfiguration;
  restoreConfiguration: RestoreSecurityConfiguration;
}
