import type { IamApplication } from "@architecture/iam/application";

import { createActivateUserController } from "./activate-user/activate-user.controller.js";
import { createAssignUserRoleController } from "./assign-user-role/assign-user-role.controller.js";
import { createChangeEmailController } from "./change-email/change-email.controller.js";
import { createChangePasswordController } from "./change-password/change-password.controller.js";
import { createGetCurrentAccountController } from "./get-current-account/get-current-account.controller.js";
import { createGetUserAdministrationOverviewController } from "./get-user-administration-overview/get-user-administration-overview.controller.js";
import { createListCurrentUserSessionsController } from "./list-user-sessions/list-current-user-sessions.controller.js";
import { createListUserSessionsController } from "./list-user-sessions/list-user-sessions.controller.js";
import { createListUsersController } from "./list-users/list-users.controller.js";
import {
  createEvaluatePasswordController,
  createGetPasswordPolicyController,
} from "./password-policy/password-policy.controller.js";
import { createResendEmailVerificationController } from "./resend-email-verification/resend-email-verification.controller.js";
import { createRevokeCurrentUserSessionController } from "./revoke-user-session/revoke-current-user-session.controller.js";
import { createRevokeUserSessionController } from "./revoke-user-session/revoke-user-session.controller.js";
import {
  createSignInController,
  type SessionCookieOptions,
} from "./sign-in/sign-in.controller.js";
import { createSignOutController } from "./sign-out/sign-out.controller.js";
import { createSignUpController } from "./sign-up/sign-up.controller.js";
import { createSuspendUserController } from "./suspend-user/suspend-user.controller.js";
import { createVerifyEmailController } from "./verify-email/verify-email.controller.js";

export type IamControllers = ReturnType<typeof composeIamControllers>;

export function composeIamControllers(
  container: IamApplication,
  sessionCookie: SessionCookieOptions,
) {
  return {
    signUp: createSignUpController(container.accounts.signUp),
    getPasswordPolicy: createGetPasswordPolicyController(
      container.accounts.getPasswordPolicy,
    ),
    evaluatePassword: createEvaluatePasswordController(
      container.accounts.evaluatePassword,
    ),
    signIn: createSignInController(
      container.authentication.signIn,
      sessionCookie,
    ),
    signOut: createSignOutController(
      container.authentication.signOut,
      sessionCookie,
    ),
    getCurrentAccount: createGetCurrentAccountController(
      container.accounts.getCurrentAccount,
    ),
    getUserAdministrationOverview:
      createGetUserAdministrationOverviewController(
        container.administration.getUserAdministrationOverview,
      ),
    verifyEmail: createVerifyEmailController(container.accounts.verifyEmail),
    resendEmailVerification: createResendEmailVerificationController(
      container.accounts.resendEmailVerification,
    ),
    changeEmail: createChangeEmailController(container.accounts.changeEmail),
    changePassword: createChangePasswordController(
      container.accounts.changePassword,
    ),
    activateUser: createActivateUserController(
      container.administration.activateUser,
    ),
    suspendUser: createSuspendUserController(
      container.administration.suspendUser,
    ),
    assignUserRole: createAssignUserRoleController(
      container.administration.assignUserRole,
    ),
    listUsers: createListUsersController(container.administration.listUsers),
    listUserSessions: createListUserSessionsController(
      container.administration.listUserSessions,
    ),
    listCurrentUserSessions: createListCurrentUserSessionsController(
      container.authentication.listCurrentUserSessions,
    ),
    revokeUserSession: createRevokeUserSessionController(
      container.administration.revokeUserSession,
    ),
    revokeCurrentUserSession: createRevokeCurrentUserSessionController(
      container.authentication.revokeCurrentUserSession,
      sessionCookie,
    ),
  };
}
