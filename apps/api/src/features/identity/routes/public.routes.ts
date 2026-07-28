import type { FastifyInstance } from "fastify";

import type { IdentityControllers } from "../compose-controllers.js";
import { signInRouteOptions } from "../sign-in/sign-in.route-options.js";
import { signOutRouteOptions } from "../sign-out/sign-out.route-options.js";
import { signUpRouteOptions } from "../sign-up/sign-up.route-options.js";
import { verifyEmailRouteOptions } from "../verify-email/verify-email.route-options.js";

export function registerPublicRoutes(controllers: IdentityControllers) {
  return async (app: FastifyInstance) => {
    app.get("/verify", verifyEmailRouteOptions, controllers.verifyEmail);
    app.post("/signup", signUpRouteOptions, controllers.signUp);
    app.post("/signin", signInRouteOptions, controllers.signIn);
    app.post("/signout", signOutRouteOptions, controllers.signOut);
  };
}
