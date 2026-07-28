import type { FastifyInstance } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";
import { activateUserRouteOptions } from "#identity/activate-user/activate-user.route-options";
import {
  type AssignUserRoleRoute,
  assignUserRoleRouteOptions,
} from "#identity/assign-user-role/assign-user-role.route-options";
import type { IdentityControllers } from "#identity/compose-controllers";
import {
  type ListUserSessionsRoute,
  listUserSessionsRouteOptions,
} from "#identity/list-user-sessions/list-user-sessions.route-options";
import { listUsersRouteOptions } from "#identity/list-users/list-users.route-options";
import {
  type RevokeUserSessionRoute,
  revokeUserSessionRouteOptions,
} from "#identity/revoke-user-session/revoke-user-session.route-options";
import {
  type SuspendUserRoute,
  suspendUserRouteOptions,
} from "#identity/suspend-user/suspend-user.route-options";

export function registerAdminRoutes(controllers: IdentityControllers) {
  return async (app: FastifyInstance) => {
    const { authenticate } = app as AuthenticatedFastifyInstance;

    app.addHook("preHandler", authenticate);

    app.addHook("preHandler", async (request, reply) => {
      if (request.auth?.role !== "admin") {
        return reply.status(403).send({
          error: { code: "FORBIDDEN" },
        });
      }
    });

    app.patch(
      "/users/:userId/activate",
      activateUserRouteOptions,
      controllers.activateUser,
    );

    app.patch<SuspendUserRoute>(
      "/users/:userId/suspend",
      suspendUserRouteOptions,
      controllers.suspendUser,
    );

    app.patch<AssignUserRoleRoute>(
      "/users/:userId/role",
      assignUserRoleRouteOptions,
      controllers.assignUserRole,
    );

    app.get("/users", listUsersRouteOptions, controllers.listUsers);

    app.get<ListUserSessionsRoute>(
      "/users/:userId/sessions",
      listUserSessionsRouteOptions,
      controllers.listUserSessions,
    );

    app.delete<RevokeUserSessionRoute>(
      "/users/:userId/sessions",
      revokeUserSessionRouteOptions,
      controllers.revokeUserSession,
    );

    app.delete<RevokeUserSessionRoute>(
      "/users/:userId/sessions/:sessionId",
      revokeUserSessionRouteOptions,
      controllers.revokeUserSession,
    );
  };
}
