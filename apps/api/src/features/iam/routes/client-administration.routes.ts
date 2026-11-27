import type {
  ClientAdministrationError,
  IamApplication,
} from "@architecture/iam/application";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";

const register = z.strictObject({
  publicId: z.string().max(128),
  displayName: z.string().max(160),
});
const permissions = z.array(z.string().min(1).max(128)).max(100);
const change = z.strictObject({
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
  command: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("rename"),
      displayName: z.string().max(160),
    }),
    z.strictObject({
      kind: z.literal("configure"),
      redirectUris: z.array(z.url().max(2048)).max(32),
      policies: z
        .array(
          z.strictObject({
            resourceId: z.string().min(1).max(128),
            required: permissions,
            optional: permissions,
          }),
        )
        .max(32),
    }),
    z.strictObject({ kind: z.literal("enable") }),
    z.strictObject({ kind: z.literal("disable") }),
  ]),
  confirmation: z
    .strictObject({
      password: z.string().min(1).max(1024),
      mfaCode: z.string().max(128).optional(),
    })
    .optional(),
});

const statuses = {
  forbidden: 403,
  session_invalid: 401,
  confirmation_refused: 403,
  attempts_exhausted: 429,
  revision_conflict: 409,
  client_not_found: 404,
  public_id_conflict: 409,
  invalid_client: 422,
} satisfies Record<ClientAdministrationError, number>;

function failure(reply: FastifyReply, code: ClientAdministrationError) {
  return reply
    .status(statuses[code])
    .send({ error: { code: `delegated_clients.${code}` } });
}

export function buildClientAdministrationRoutes(
  clients: IamApplication["clientAdministration"],
  origin: string,
): FastifyPluginAsync {
  return async (app) => {
    const start = new WeakMap<object, number>();
    app.addHook("onRequest", async (request, reply) => {
      start.set(request, performance.now());
      reply.header("Cache-Control", "no-store");
      const supplied = request.headers.origin;
      if (
        (supplied !== undefined || request.method === "POST") &&
        supplied !== origin
      ) {
        return failure(reply, "forbidden");
      }
    });
    app.addHook("preValidation", app.authenticate);
    app.addHook("preValidation", async (request, reply) => {
      if (request.auth?.role !== "admin") {
        return failure(reply, "forbidden");
      }
    });
    app.get("/admin/delegated-clients", async ({ auth }, reply) => {
      if (!auth) {
        return failure(reply, "session_invalid");
      }
      const result = await clients.list.execute({
        accountId: auth.userId,
        sessionId: auth.sessionId,
      });
      return result.success
        ? reply.send({ data: result.value })
        : failure(reply, result.error.code);
    });
    app.post(
      "/admin/delegated-clients",
      { bodyLimit: 8192 },
      async ({ auth, body }, reply) => {
        if (!auth) {
          return failure(reply, "session_invalid");
        }
        const parsed = register.safeParse(body);
        if (!parsed.success) {
          return failure(reply, "invalid_client");
        }
        const result = await clients.register.execute(
          { accountId: auth.userId, sessionId: auth.sessionId },
          parsed.data,
        );
        return result.success
          ? reply.code(201).send({ data: result.value })
          : failure(reply, result.error.code);
      },
    );
    app.post<{ Params: { id: string } }>(
      "/admin/delegated-clients/:id/change",
      { bodyLimit: 65_536 },
      async (request, reply) => {
        const { auth, body, params } = request;
        if (!auth) {
          return failure(reply, "session_invalid");
        }
        const parsed = change.safeParse(body);
        if (!parsed.success || !z.uuid().safeParse(params.id).success) {
          return failure(reply, "invalid_client");
        }
        const { expectedRevision, command, confirmation } = parsed.data;
        const result = await clients.change.execute({
          actor: { accountId: auth.userId, sessionId: auth.sessionId },
          clientId: params.id,
          expectedRevision,
          command,
          startedAt: start.get(request),
          confirmation: confirmation && {
            password: confirmation.password,
            ...(confirmation.mfaCode === undefined
              ? {}
              : { mfaCode: confirmation.mfaCode }),
          },
        });
        return result.success
          ? reply.send({ data: result.value })
          : failure(reply, result.error.code);
      },
    );
  };
}
