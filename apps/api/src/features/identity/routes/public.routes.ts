import type { FastifyInstance } from "fastify";

import type { IdentityControllers } from "#identity/compose-controllers";
import { signInRouteOptions } from "#identity/sign-in/sign-in.route-options";
import { signOutRouteOptions } from "#identity/sign-out/sign-out.route-options";
import { signUpRouteOptions } from "#identity/sign-up/sign-up.route-options";
import { verifyEmailRouteOptions } from "#identity/verify-email/verify-email.route-options";

export function registerPublicRoutes(controllers: IdentityControllers) {
  return async (app: FastifyInstance) => {
    app.get("/verify", verifyEmailRouteOptions, controllers.verifyEmail);
    app.post("/signup", signUpRouteOptions, controllers.signUp);
    app.post("/signin", signInRouteOptions, controllers.signIn);
    app.post("/signout", signOutRouteOptions, controllers.signOut);
  };
}
