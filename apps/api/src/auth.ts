import fastifyCookie, { type CookieSerializeOptions } from "@fastify/cookie";
import type { ResolveSessionUseCase } from "@architecture/identity/application";
import type {
  FastifyInstance,
  FastifyPluginAsync,
  preHandlerHookHandler,
} from "fastify";
import fp from "fastify-plugin";

export const SESSION_COOKIE_NAME = "sid";

export interface AuthenticatedContext {
  userId: string;
  sessionId: string;
}

export interface AuthenticatedFastifyInstance extends FastifyInstance {
  authenticate: preHandlerHookHandler;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthenticatedContext | null;
  }

  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
  }
}

interface AuthPluginOptions {
  resolveSession: ResolveSessionUseCase;
  sessionCookieName: string;
}

export function buildSessionCookieOptions(): CookieSerializeOptions {
  const isProduction = process.env["NODE_ENV"] === "production";

  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isProduction,
  };
}

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (app, opts) => {
  await app.register(fastifyCookie);

  app.decorateRequest("auth", null);

  app.decorate("authenticate", async (request, reply) => {
    const sessionId = request.cookies[opts.sessionCookieName];

    if (!sessionId) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED" },
      });
    }

    const result = await opts.resolveSession.execute({
      sessionId,
    });

    if (!result.success) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED" },
      });
    }

    request.auth = result.value;
  });
};

export const authPlugin = fp(plugin, {
  name: "auth",
});
