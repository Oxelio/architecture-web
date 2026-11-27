import Fastify from "fastify";

export function fastifyHost(handle, issuer) {
  const app = Fastify({ logger: false, exposeHeadRoutes: false });
  app.register(async (protocol) => {
    const bridge = async (request, reply) => {
      reply.hijack();
      const raw = request.raw;
      const response = reply.raw;
      // Bound the provider-owned read, including chunked bodies. Fastify's
      // bodyLimit does not protect a request hijacked before its parser.
      if (request.method === "POST") {
        const deadline = setTimeout(() => raw.destroy(), 1000);
        raw.once("end", () => clearTimeout(deadline));
        raw.once("close", () => clearTimeout(deadline));
      }
      await handle(raw, response);
    };

    for (const url of ["/auth", "/auth/:uid", "/consent/:uid", "/admit"]) {
      protocol.route({
        method: "GET",
        url,
        onRequest: bridge,
        handler: unused,
      });
    }
    for (const url of ["/token", "/consent/:uid"]) {
      protocol.route({
        method: "POST",
        url,
        onRequest: bridge,
        handler: unused,
      });
    }
    protocol.get(
      "/.well-known/oauth-authorization-server",
      async (_request, reply) => {
        reply.header("Cache-Control", "no-store");
        return {
          issuer,
          authorization_endpoint: issuer + "/auth",
          token_endpoint: issuer + "/token",
          response_types_supported: ["code"],
          response_modes_supported: ["query"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          scopes_supported: ["read", "write"],
          token_endpoint_auth_methods_supported: ["none"],
          code_challenge_methods_supported: ["S256"],
          authorization_response_iss_parameter_supported: true,
        };
      },
    );
  });
  return app;
}

function unused() {
  throw new Error("The raw protocol bridge must own the response");
}
