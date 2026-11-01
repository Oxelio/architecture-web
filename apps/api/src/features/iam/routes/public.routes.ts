import type { FastifyInstance } from "fastify";

import type { IamControllers } from "#iam/compose-controllers";
import {
  type EvaluatePasswordRoute,
  evaluatePasswordRouteOptions,
  getPasswordPolicyRouteOptions,
} from "#iam/password-policy/password-policy.route-options";
import { signInRouteOptions } from "#iam/sign-in/sign-in.route-options";
import { signOutRouteOptions } from "#iam/sign-out/sign-out.route-options";
import { signUpRouteOptions } from "#iam/sign-up/sign-up.route-options";
import { verifyEmailRouteOptions } from "#iam/verify-email/verify-email.route-options";

export function registerPublicRoutes(controllers: IamControllers) {
  return (app: FastifyInstance) => {
    try {
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

      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  };
}
