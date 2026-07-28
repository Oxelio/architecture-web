import type { FastifyInstance } from "fastify";

import type { IdentityControllers } from "#identity/compose-controllers";
import {
  type EvaluatePasswordRoute,
  evaluatePasswordRouteOptions,
  getPasswordPolicyRouteOptions,
} from "#identity/password-policy/password-policy.route-options";
import { signInRouteOptions } from "#identity/sign-in/sign-in.route-options";
import { signOutRouteOptions } from "#identity/sign-out/sign-out.route-options";
import { signUpRouteOptions } from "#identity/sign-up/sign-up.route-options";
import { verifyEmailRouteOptions } from "#identity/verify-email/verify-email.route-options";

export function registerPublicRoutes(controllers: IdentityControllers) {
  return async (app: FastifyInstance) => {
    app.get("/verify", verifyEmailRouteOptions, controllers.verifyEmail);
    app.post("/signup", signUpRouteOptions, controllers.signUp);
    app.get(
      "/password-policy",
      getPasswordPolicyRouteOptions,
      controllers.getPasswordPolicy,
    );
    app.post<EvaluatePasswordRoute>(
      "/password-policy/evaluate",
      evaluatePasswordRouteOptions,
      controllers.evaluatePassword,
    );
    app.post("/signin", signInRouteOptions, controllers.signIn);
    app.post("/signout", signOutRouteOptions, controllers.signOut);
  };
}
