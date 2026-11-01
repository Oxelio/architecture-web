import type { FastifyInstance } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";
import { activateUserRouteOptions } from "#iam/activate-user/activate-user.route-options";
import {
  type AssignUserRoleRoute,
  assignUserRoleRouteOptions,
} from "#iam/assign-user-role/assign-user-role.route-options";
import type { IamControllers } from "#iam/compose-controllers";
import { getUserAdministrationOverviewRouteOptions } from "#iam/get-user-administration-overview/get-user-administration-overview.route-options";
import {
  type ListUserSessionsRoute,
  listUserSessionsRouteOptions,
} from "#iam/list-user-sessions/list-user-sessions.route-options";
import {
  type ListUsersRoute,
  listUsersRouteOptions,
} from "#iam/list-users/list-users.route-options";
import {
  type RevokeUserSessionRoute,
  revokeUserSessionRouteOptions,
} from "#iam/revoke-user-session/revoke-user-session.route-options";
import {
  type SuspendUserRoute,
  suspendUserRouteOptions,
} from "#iam/suspend-user/suspend-user.route-options";

export function registerAdminRoutes(controllers: IamControllers) {
  return (app: FastifyInstance) => {
    try {
      const { authenticate } = app as AuthenticatedFastifyInstance;

      app.addHook("preHandler", authenticate);

      app.addHook("preHandler", (request, reply) => {
        try {
          if (request.auth?.role !== "admin") {
            return Promise.resolve(
              reply.status(403).send({
                error: { code: "authorization.forbidden" },
              }),
            );
          }

          return Promise.resolve();
        } catch (error: unknown) {
          return Promise.reject(error);
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

      app.get(
        "/users/overview",
        getUserAdministrationOverviewRouteOptions,
        controllers.getUserAdministrationOverview,
      );

      app.get<ListUsersRoute>(
        "/users",
        listUsersRouteOptions,
        controllers.listUsers,
      );

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

      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  };
}
