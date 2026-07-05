import type { IdentityContainer } from "../../composition-root/identity.container.js";
import { buildSignUpController } from "#controllers/identity/sign-up.controller";
import { buildSignInController } from "#controllers/identity/sign-in.controller";
import { buildSignOutController } from "#controllers/identity/sign-out.controller";
import { buildGetUserProfileController } from "#controllers/identity/get-user-profile.controller";
import { buildVerifyEmailController } from "#controllers/identity/verify-email.controller";
import { buildChangeEmailController } from "#controllers/identity/change-email.controller";
import { buildChangePasswordController } from "#controllers/identity/change-password.controller";
import { buildActivateUserController } from "#controllers/identity/activate-user.controller";
import { buildSuspendUserController } from "#controllers/identity/suspend-user.controller";
import type { SessionCookieOptions } from "#controllers/identity/sign-in.controller";

export function buildIdentityControllers(
  container: IdentityContainer,
  sessionCookie: SessionCookieOptions,
) {
  return {
    signUp: buildSignUpController(container.signUp),
    signIn: buildSignInController(container.signIn, sessionCookie),
    signOut: buildSignOutController(container.signOut, sessionCookie),
    getUserProfile: buildGetUserProfileController(container.getUserProfile),
    verifyEmail: buildVerifyEmailController(container.verifyEmail),
    changeEmail: buildChangeEmailController(container.changeEmail),
    changePassword: buildChangePasswordController(container.changePassword),
    activateUser: buildActivateUserController(container.activateUser),
    suspendUser: buildSuspendUserController(container.suspendUser),
  };
}
