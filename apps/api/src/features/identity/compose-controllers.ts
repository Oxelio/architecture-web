import type { IdentityApplication } from "@architecture/identity/application";

import { createActivateUserController } from "./activate-user/activate-user.controller.js";
import { createAssignUserRoleController } from "./assign-user-role/assign-user-role.controller.js";
import { createChangeEmailController } from "./change-email/change-email.controller.js";
import { createChangePasswordController } from "./change-password/change-password.controller.js";
import { createGetUserProfileController } from "./get-user-profile/get-user-profile.controller.js";
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

export type IdentityControllers = ReturnType<typeof composeIdentityControllers>;

export function composeIdentityControllers(
  container: IdentityApplication,
  sessionCookie: SessionCookieOptions,
) {
  return {
    signUp: createSignUpController(container.signUp),
    getPasswordPolicy: createGetPasswordPolicyController(
      container.getPasswordPolicy,
    ),
    evaluatePassword: createEvaluatePasswordController(
      container.evaluatePassword,
    ),
    signIn: createSignInController(container.signIn, sessionCookie),
    signOut: createSignOutController(container.signOut, sessionCookie),
    getUserProfile: createGetUserProfileController(container.getUserProfile),
    verifyEmail: createVerifyEmailController(container.verifyEmail),
    resendEmailVerification: createResendEmailVerificationController(
      container.resendEmailVerification,
    ),
    changeEmail: createChangeEmailController(container.changeEmail),
    changePassword: createChangePasswordController(container.changePassword),
    activateUser: createActivateUserController(container.activateUser),
    suspendUser: createSuspendUserController(container.suspendUser),
    assignUserRole: createAssignUserRoleController(container.assignUserRole),
    listUsers: createListUsersController(container.listUsers),
    listUserSessions: createListUserSessionsController(
      container.listUserSessions,
    ),
    listCurrentUserSessions: createListCurrentUserSessionsController(
      container.listUserSessions,
    ),
    revokeUserSession: createRevokeUserSessionController(
      container.revokeUserSession,
    ),
    revokeCurrentUserSession: createRevokeCurrentUserSessionController(
      container.revokeUserSession,
      sessionCookie,
    ),
  };
}
